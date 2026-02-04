// Note: In serverless, this map resets when the worker instance recycles.
// For strict global limits, Cloudflare Rate Limiting (Paid) or KV is needed.

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic, difficulty = 'Mixed', lang = 'ko', bypassCache = false } = await request.json();

        // --- 1. KV CACHE CHECK (Edge Caching) ---
        // If available, serve instantly from the Edge
        if (env.QUIZ_CACHE && !bypassCache) {
            const cacheKey = `quiz:${lang}:${topic}:${difficulty}`;
            try {
                // Get cached data (array of question batches)
                const cachedRaw = await env.QUIZ_CACHE.get(cacheKey);
                if (cachedRaw) {
                    const cachedData = JSON.parse(cachedRaw);
                    if (Array.isArray(cachedData) && cachedData.length > 0) {
                        // Pick a random batch from cache to vary questions slightly if we stored multiple
                        // For now, we assume simple caching: just return the stored set
                        // But to make it feel dynamic, we shuffle the result
                        const shuffled = cachedData.sort(() => Math.random() - 0.5);
                        
                        return new Response(JSON.stringify(shuffled), {
                            headers: { 
                                'Content-Type': 'application/json',
                                'X-Quiz-Source': 'KV_CACHE' // Debug header
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn("KV Read Error:", e);
            }
        }

        let aiAvailable = true;
        if (!env.AI) {
            console.warn("AI Binding Missing - Using Mock Data");
            aiAvailable = false;
        }

        // Standardized Topic Keys to Open Trivia Category IDs
        const categoryMap = {
            "general": 9,
            "science": 17,
            "sports": 21,
            "movies": 11,
            "music": 12,
            "history": 23, // History (Global)
            "geography": 22 // Geography (Global)
        };

        // Naver Search Keywords mapped to Standardized Keys
        const TOPIC_KEYWORDS = {
            "history": ["한국사", "세종대왕", "이순신", "안중근", "경복궁", "불국사", "임진왜란", "3.1운동", "조선왕조실록", "팔만대장경", "첨성대", "석굴암", "거북선", "훈민정음", "동학농민운동", "병자호란"],
            "science": ["태양계", "주기율표", "뉴턴", "아인슈타인", "광합성", "블랙홀", "DNA", "인공지능", "지구온난화", "빅뱅이론", "미세먼지", "전기자동차", "노벨상", "백신", "상대성이론"],
            "sports": ["손흥민", "김연아", "류현진", "월드컵", "올림픽", "e스포츠", "페이커", "태권도", "마라톤", "양궁", "박지성", "메이저리그", "프리미어리그", "K리그", "쇼트트랙"],
            "movies": ["기생충", "봉준호", "오징어게임", "천만관객", "칸영화제", "아카데미상", "마블", "디즈니", "부산국제영화제", "박찬욱", "미야자키하야오", "충무로", "독립영화", "넷플릭스", "CGV"],
            "music": ["BTS", "K-POP", "베토벤", "모차르트", "판소리", "트로트", "임영웅", "뉴진스", "빌보드", "국악", "쇼팽", "뮤지컬", "노래방", "힙합", "사물놀이"],
            "general": ["한글", "독도", "김치", "비빔밥", "서울", "제주도", "한강", "경주", "화폐", "국회의사당", "무궁화", "태극기", "애국가", "스마트폰", "유튜브"],
            "geography": ["대한민국", "제주도", "독도", "한강", "설악산", "부산", "백두산", "한라산", "에베레스트", "아마존강", "사하라사막", "위도경도", "5대양6대주", "시베리아", "나일강"]
        };

        const categoryId = categoryMap[topic];
        let promptMode = 'GENERATE'; 
        let sourceQuestions = [];
        let factContext = "";
        let debugLog = []; // Collect debug info

        // --- STRATEGY: SPLIT BY LANGUAGE ---

        // 1. ENGLISH MODE -> Use Open Trivia DB
        if (lang === 'en' && categoryId) {
            try {
                let apiDiff = '';
                if (difficulty === 'Easy') apiDiff = '&difficulty=easy';
                if (difficulty === 'Medium') apiDiff = '&difficulty=medium';
                if (difficulty === 'Hard') apiDiff = '&difficulty=hard';

                const apiUrl = `https://opentdb.com/api.php?amount=10&category=${categoryId}&type=multiple${apiDiff}`;
                const apiRes = await fetch(apiUrl);
                const apiData = await apiRes.json();

                if (apiData.response_code === 0 && apiData.results.length > 0) {
                    sourceQuestions = apiData.results;
                    promptMode = 'FORMAT_ONLY';
                    debugLog.push("OpenTrivia Success");
                } else {
                    debugLog.push(`OpenTrivia Failed: Code ${apiData.response_code}`);
                }
            } catch (err) {
                console.error("Open Trivia DB Fetch Failed:", err);
                debugLog.push(`OpenTrivia Error: ${err.message}`);
            }
        } 
        
        // 2. KOREAN MODE -> Use Naver Open API (Encyclopedia)
        else if (lang === 'ko' && TOPIC_KEYWORDS[topic]) {
            if (!env.NAVER_CLIENT_ID) {
                debugLog.push("Naver Keys Missing in Env");
            } else {
                try {
                    const keywords = TOPIC_KEYWORDS[topic];
                    const selectedKeywords = keywords.sort(() => 0.5 - Math.random()).slice(0, 3);
                    debugLog.push(`Naver Keywords: ${selectedKeywords.join(',')}`);
                    
                    // [SPEED IMPROVEMENT] Parallel Execution using Promise.all
                    const searchPromises = selectedKeywords.map(kw => 
                        fetch(`https://openapi.naver.com/v1/search/encyc.json?query=${encodeURIComponent(kw)}&display=2`, {
                            headers: {
                                "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
                                "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET
                            }
                        }).then(res => res.ok ? res.json() : null)
                    );

                    const results = await Promise.all(searchPromises);
                    
                    let searchResults = [];
                    results.forEach((naverData, index) => {
                        if (naverData && naverData.items && naverData.items.length > 0) {
                            const kw = selectedKeywords[index];
                            searchResults.push(...naverData.items.map(item => 
                                `[${kw}] ${item.title.replace(/<[^>]*>?/gm, '')}: ${item.description.replace(/<[^>]*>?/gm, '')}`
                            ));
                        }
                    });

                    if (searchResults.length > 0) {
                        factContext = searchResults.join("\n\n");
                        promptMode = 'NAVER_FACTS';
                        debugLog.push("Naver Success");
                    } else {
                        debugLog.push("Naver No Results");
                    }
                } catch (err) {
                    console.error("Naver API Fetch Failed:", err);
                    debugLog.push(`Naver Exception: ${err.message}`);
                }
            }
        }

        const model = '@cf/meta/llama-3-8b-instruct';
        let systemPrompt = '';
        let userPrompt = '';

        // [ACCURACY IMPROVEMENT] Switch to JSON Format Prompting
        const jsonInstruction = `
        You must output ONLY a valid JSON array of objects. Do not wrap in markdown code blocks.
        JSON Format:
        [
            {
                "question": "Question text here?",
                "correct": "Correct Answer",
                "wrong": ["Wrong1", "Wrong2", "Wrong3"]
            }
        ]
        `;
        
        // Random Seed to force variety
        const randomSeed = Math.random().toString(36).substring(7);

        if (promptMode === 'FORMAT_ONLY') {
            systemPrompt = `You are a quiz formatter. Convert the input into the specified JSON format. Ensure every question is unique and formatted perfectly. ${jsonInstruction}`;
            userPrompt = `Convert these questions:\n${JSON.stringify(sourceQuestions)}`;

        } else if (promptMode === 'NAVER_FACTS') {
            systemPrompt = `당신은 대한민국 최고의 예능 퀴즈 작가입니다.
            제공된 [참고 자료]를 바탕으로 시청자가 처음 들어볼 법한 아주 신선하고 독특한 퀴즈 10문제를 만드세요.

            [절대 원칙]
            1. **중복 금지**: 이전에 나왔을 법한 뻔한 문제는 배제하고, 자료의 세부적인 내용을 파고드세요.
            2. **포맷**: 반드시 **JSON 배열**로만 출력하세요. (서론/결론 금지)
            3. **다양성**: Seed(${randomSeed})를 활용하여 매번 다른 관점에서 질문하세요.
            4. **문체**: 예능 자막처럼 자연스러운 '해요체' (~인가요? ~은 무엇일까요?)
            ${jsonInstruction}`;

            userPrompt = `[참고 자료]:\n${factContext}\n\n위 자료를 바탕으로 ${difficulty} 난이도 퀴즈 10개를 JSON으로 생성하세요.`;

        } else {
            systemPrompt = `당신은 세상에 없던 문제를 만드는 천재 퀴즈 작가입니다. 주제에 대해 누구도 예상치 못한 참신하고 다양한 퀴즈 10개를 만드세요.
                [절대 원칙]
                1. 오직 JSON 배열만 출력.
                2. **독창성**: 초등학생도 아는 상식적인 문제는 금지합니다. 매우 구체적이고 흥미로운 사실을 다루세요.
                3. **다양성 보장**: Seed(${randomSeed})를 반영하여 기존과 완전히 다른 문제를 만드세요.
                4. 자연스러운 해요체 사용.
                ${jsonInstruction}`;
            userPrompt = `주제: "${topic}"\n난이도: ${difficulty}\n위 조건으로 절대 중복되지 않는 창의적인 퀴즈 10개를 JSON으로 만들어주세요.`;
        }

        let aiResponse;
        if (aiAvailable && env.AI) {
            try {
                aiResponse = await env.AI.run(model, {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.9, // Variety max
                    top_p: 0.9 // Diversity filter
                });
            } catch (aiErr) {
                console.error("AI Run Error:", aiErr);
                debugLog.push(`AI Error: ${aiErr.message}`);
                aiAvailable = false; // Fallback to mock
            }
        }

        if (!aiAvailable || !env.AI || !aiResponse) {
            throw new Error("AI Service Unavailable and Mock Data is disabled.");
        }

        let textData = '';
        if (aiResponse && aiResponse.response) {
            textData = aiResponse.response;
        } else {
            textData = JSON.stringify(aiResponse);
        }

        // [PARSING IMPROVEMENT] Robust JSON Parsing
        let quizData = [];
        try {
            // ... (Previous Parsing Logic) ...
            // Clean up potential Markdown wrappers (```json ... ```) or leading/trailing junk
            let cleanJson = textData.trim();
            if (cleanJson.includes("```")) {
                cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
            }
            const startIdx = cleanJson.indexOf('[');
            const endIdx = cleanJson.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
                cleanJson = cleanJson.substring(startIdx, endIdx + 1);
            }

            const rawData = JSON.parse(cleanJson);
            
            if (Array.isArray(rawData)) {
                // --- [NEW] AI REVIEW STEP (Quality Assurance) ---
                if (aiAvailable && env.AI) {
                    try {
                        const reviewPrompt = `
                        You are a strict Quiz Auditor. Review the following quiz questions for accuracy and clarity. 
                        
                        [Rules]
                        1. Discard questions with factual errors.
                        2. Discard questions where the answer is ambiguous.
                        3. Discard questions where 'correct' matches one of the 'wrong' options.
                        4. Output ONLY the valid questions as a JSON array.
                        
                        [Input Questions]
                        ${JSON.stringify(rawData)}
                        `;

                        const reviewResponse = await env.AI.run(model, {
                            messages: [{ role: 'user', content: reviewPrompt }],
                            temperature: 0.2 // Low temperature for strict logic
                        });

                        // Attempt to parse review result
                        let reviewedJson = reviewResponse.response.trim();
                        if (reviewedJson.includes("```")) {
                            reviewedJson = reviewedJson.replace(/```json/g, '').replace(/```/g, '').trim();
                        }
                        const sIdx = reviewedJson.indexOf('[');
                        const eIdx = reviewedJson.lastIndexOf(']');
                        if (sIdx !== -1 && eIdx !== -1) {
                            reviewedJson = reviewedJson.substring(sIdx, eIdx + 1);
                        }
                        
                        const validatedData = JSON.parse(reviewedJson);
                        if (Array.isArray(validatedData) && validatedData.length > 0) {
                            debugLog.push(`QA Passed: ${validatedData.length}/${rawData.length} questions`);
                            // Use validated data
                            quizData = validatedData.map(item => ({
                                question: item.question,
                                correct: item.correct,
                                answers: [item.correct, ...item.wrong].sort(() => Math.random() - 0.5)
                            }));
                        } else {
                            debugLog.push("QA Failed to return valid JSON, using original draft.");
                            // Fallback to original if reviewer hallucinated
                            quizData = rawData.map(item => ({
                                question: item.question,
                                correct: item.correct,
                                answers: [item.correct, ...item.wrong].sort(() => Math.random() - 0.5)
                            }));
                        }
                    } catch (qaErr) {
                        debugLog.push(`QA Error: ${qaErr.message} - Using draft.`);
                         quizData = rawData.map(item => ({
                            question: item.question,
                            correct: item.correct,
                            answers: [item.correct, ...item.wrong].sort(() => Math.random() - 0.5)
                        }));
                    }
                } else {
                    // No AI for review, just use raw
                    quizData = rawData.map(item => ({
                        question: item.question,
                        correct: item.correct,
                        answers: [item.correct, ...item.wrong].sort(() => Math.random() - 0.5)
                    }));
                }
            }
        } catch (e) {
            // ... (Existing Catch Block) ...
            console.error("JSON Parse Failed, throwing error instead of mock. Raw Data:", textData.slice(0, 200));
            debugLog.push(`Parse Error: ${e.message}`);
            throw new Error(`JSON Parse Failed: ${e.message}`);
        }

        if (quizData.length === 0) {
            throw new Error("No quiz data generated");
        }

        // --- 2. KV CACHE SAVE (Write Back) ---
        if (env.QUIZ_CACHE) {
            const cacheKey = `quiz:${lang}:${topic}:${difficulty}`;
            try {
                // Cache for 24 hours (86400 seconds)
                // We overwrite the existing cache with the freshest AI generation
                // Ideally, we could append to a list, but simple overwrite is fine for "Daily Quiz" concept
                await env.QUIZ_CACHE.put(cacheKey, JSON.stringify(quizData), { expirationTtl: 86400 });
            } catch (e) {
                console.warn("KV Write Error:", e);
            }
        }

        let encodedDebug = "";
        try {
            const utf8Bytes = new TextEncoder().encode(JSON.stringify(debugLog));
            const binString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join("");
            encodedDebug = btoa(binString);
        } catch (e) {
            encodedDebug = btoa("EncodingError");
        }

        return new Response(JSON.stringify(quizData), {
            headers: { 
                'Content-Type': 'application/json; charset=utf-8',
                'X-Quiz-Source': promptMode,
                'X-Debug-Log': encodedDebug
            },
        });

    } catch (e) {
        return new Response(JSON.stringify({
            error: "Quiz Generation Failed", 
            message: e.message 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
