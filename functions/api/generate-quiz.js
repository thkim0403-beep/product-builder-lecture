export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic, difficulty = 'Mixed', lang = 'ko' } = await request.json();

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

        if (promptMode === 'FORMAT_ONLY') {
            systemPrompt = `You are a quiz formatter. Convert the input into the specified JSON format. ${jsonInstruction}`;
            userPrompt = `Convert these questions:\n${JSON.stringify(sourceQuestions)}`;

        } else if (promptMode === 'NAVER_FACTS') {
            systemPrompt = `당신은 대한민국 최고의 예능 퀴즈 작가입니다.
            제공된 [참고 자료]를 바탕으로 시청자가 흥미를 느낄 만한 객관식 퀴즈 10문제를 만드세요.

            [원칙]
            1. **포맷**: 반드시 **JSON 배열**로만 출력하세요. (서론/결론 금지)
            2. **문체**: 예능 자막처럼 자연스러운 '해요체' (~인가요? ~은 무엇일까요?)
            3. **표기**: 인명/지명은 한글로(웨인 루니), 통용 약어는 영어 허용(DNA, TV).
            4. **오답**: 정답과 헷갈리는 그럴듯한 오답 배치.
            ${jsonInstruction}`;

            userPrompt = `[참고 자료]:\n${factContext}\n\n위 자료를 바탕으로 ${difficulty} 난이도 퀴즈 10개를 JSON으로 생성하세요.`;

        } else {
            systemPrompt = `당신은 한국어 퀴즈 작가입니다. 주제에 맞는 퀴즈 10개를 만드세요.
                [원칙]
                1. 오직 JSON 배열만 출력.
                2. 인명/지명은 한글 표기 필수.
                3. 자연스러운 해요체 사용.
                ${jsonInstruction}`;
            userPrompt = `주제: "${topic}"\n난이도: ${difficulty}\n위 조건으로 퀴즈 10개를 JSON으로 만들어주세요.`;
        }

        let aiResponse;
        if (aiAvailable && env.AI) {
            try {
                aiResponse = await env.AI.run(model, {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.5
                });
            } catch (aiErr) {
                console.error("AI Run Error:", aiErr);
                debugLog.push(`AI Error: ${aiErr.message}`);
                aiAvailable = false; // Fallback to mock
            }
        }

        if (!aiAvailable || !env.AI || !aiResponse) {
            // Mock Data (Updated to JSON) with realistic examples
            debugLog.push("Using Mock Data Fallback");
            
            const MOCK_DB = {
                "history": [
                    { "question": "조선왕조실록은 유네스코 세계기록유산이다. (O/X)", "correct": "O", "wrong": ["X"] },
                    { "question": "임진왜란 당시 거북선을 만든 장군은?", "correct": "이순신", "wrong": ["권율", "강감찬", "을지문덕"] },
                    { "question": "3.1 운동이 일어난 해는?", "correct": "1919년", "wrong": ["1945년", "1910년", "1950년"] },
                    { "question": "훈민정음을 창제한 왕은?", "correct": "세종대왕", "wrong": ["태조", "영조", "정조"] },
                    { "question": "고려를 건국한 왕은?", "correct": "왕건", "wrong": ["이성계", "궁예", "견훤"] },
                    { "question": "신라의 수도는 어디였나요?", "correct": "경주", "wrong": ["서울", "평양", "부여"] },
                    { "question": "대한민국 임시정부의 초대 대통령은?", "correct": "이승만", "wrong": ["김구", "안창호", "박은식"] },
                    { "question": "을지문덕 장군이 활약한 전쟁은?", "correct": "살수대첩", "wrong": ["귀주대첩", "행주대첩", "한산도대첩"] },
                    { "question": "발해를 건국한 사람은?", "correct": "대조영", "wrong": ["왕건", "궁예", "견훤"] },
                    { "question": "동학농민운동의 지도자는?", "correct": "전봉준", "wrong": ["최제우", "최시형", "손병희"] }
                ],
                "science": [
                    { "question": "물(H2O)을 구성하는 원소가 아닌 것은?", "correct": "탄소", "wrong": ["수소", "산소"] },
                    { "question": "태양계에서 가장 큰 행성은?", "correct": "목성", "wrong": ["지구", "화성", "토성"] },
                    { "question": "지구의 위성은?", "correct": "달", "wrong": ["타이탄", "유로파", "이오"] },
                    { "question": "빛의 삼원색이 아닌 것은?", "correct": "노랑", "wrong": ["빨강", "초록", "파랑"] },
                    { "question": "사람의 몸에서 가장 큰 장기는?", "correct": "피부", "wrong": ["간", "심장", "폐"] }
                ],
                "default": []
            };

            // Fill default mock
            for(let i=1; i<=10; i++) {
                MOCK_DB.default.push({
                    "question": `[Mock] ${topic}에 관한 ${difficulty} 난이도 문제 ${i} (언어: ${lang})`,
                    "correct": "정답",
                    "wrong": ["오답1", "오답2", "오답3"]
                });
            }

            const selectedMocks = MOCK_DB[topic] || MOCK_DB.default;
            // Fill up to 10 if not enough (e.g. science has 5)
            const resultMocks = [...selectedMocks];
            while(resultMocks.length < 10) {
                 resultMocks.push({
                    "question": `[Mock] ${topic} 추가 문제 ${resultMocks.length+1}`,
                    "correct": "정답",
                    "wrong": ["오답1", "오답2"]
                });
            }
            
            aiResponse = {
                response: JSON.stringify(resultMocks.slice(0, 10))
            };
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
            // Clean up potential Markdown wrappers (```json ... ```) or leading/trailing junk
            let cleanJson = textData.trim();
            if (cleanJson.includes("```")) {
                cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
            }
            
            // Find the first '[' and last ']' to extract just the array if AI added text around it
            const startIdx = cleanJson.indexOf('[');
            const endIdx = cleanJson.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
                cleanJson = cleanJson.substring(startIdx, endIdx + 1);
            }

            const rawData = JSON.parse(cleanJson);
            
            if (Array.isArray(rawData)) {
                quizData = rawData.map(item => ({
                    question: item.question,
                    correct: item.correct,
                    answers: [item.correct, ...item.wrong].sort(() => Math.random() - 0.5)
                }));
            }
        } catch (e) {
            console.error("JSON Parse Failed, falling back to emergency mock. Raw Data:", textData.slice(0, 200));
            debugLog.push(`Parse Error: ${e.message}`);
            
            // --- EMERGENCY FALLBACK TO MOCK_DB ON PARSE FAILURE ---
            const emergencyMocks = [
                { "question": "조선왕조실록은 유네스코 세계기록유산이다. (O/X)", "correct": "O", "wrong": ["X"] },
                { "question": "임진왜란 당시 거북선을 만든 장군은?", "correct": "이순신", "wrong": ["권율", "강감찬", "을지문덕"] },
                { "question": "3.1 운동이 일어난 해는?", "correct": "1919년", "wrong": ["1945년", "1910년", "1950년"] },
                { "question": "훈민정음을 창제한 왕은?", "correct": "세종대왕", "wrong": ["태조", "영조", "정조"] },
                { "question": "태양계에서 가장 큰 행성은?", "correct": "목성", "wrong": ["지구", "화성", "토성"] }
            ];
            
            quizData = emergencyMocks.map(item => ({
                question: item.question,
                correct: item.correct,
                answers: [item.correct, ...item.wrong].sort(() => Math.random() - 0.5)
            }));
        }

        if (quizData.length === 0) {
            throw new Error("No quiz data generated even after fallback");
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
