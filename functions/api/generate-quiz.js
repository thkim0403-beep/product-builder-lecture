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
                    
                    let searchResults = [];
                    for (const kw of selectedKeywords) {
                        const naverRes = await fetch(`https://openapi.naver.com/v1/search/encyc.json?query=${encodeURIComponent(kw)}&display=2`, {
                            headers: {
                                "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
                                "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET
                            }
                        });
                        
                        if (!naverRes.ok) {
                            debugLog.push(`Naver Fetch Error: ${naverRes.status}`);
                            continue;
                        }

                        const naverData = await naverRes.json();
                        if (naverData.items && naverData.items.length > 0) {
                            searchResults.push(...naverData.items.map(item => `[키워드: ${kw}] ${item.title.replace(/<[^>]*>?/gm, '')}: ${item.description.replace(/<[^>]*>?/gm, '')}`));
                        }
                    }

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

        if (promptMode === 'FORMAT_ONLY') {
            // ENGLISH: Reformat Open Trivia DB
            systemPrompt = `You are a quiz formatter. Reformat the provided questions into: QUESTION|CORRECT|WRONG1|WRONG2|WRONG3. No extra text.`;
             const sourceText = sourceQuestions.map((q, i) => {
                return `Q: ${q.question} 
Correct: ${q.correct_answer} 
Wrongs: ${q.incorrect_answers.join(', ')}`;
            }).join('\n\n');
            userPrompt = `Reformat these:\n${sourceText}`;

        } else if (promptMode === 'NAVER_FACTS') {
            // KOREAN: Generate based on Naver Encyclopedia Facts
            systemPrompt = `당신은 대한민국 인기 TV 예능 프로그램의 메인 퀴즈 작가입니다.
            제공된 [참고 자료]를 바탕으로 시청자가 흥미를 느낄 만한 센스 있고 유익한 객관식 퀴즈 10문제를 출제하세요.

            [필수 원칙]
            1. **문체**: 예능 자막처럼 자연스럽고 친근한 **'해요체'**를 사용하세요.
            2. **표기 원칙**: 
               - **사람 이름, 지명, 일반 명사**는 반드시 **한글**로 표기하세요. (예: Wayne Rooney -> 웨인 루니, New York -> 뉴욕)
               - 단, **한국에서도 영어 알파벳으로 더 많이 쓰이는 약어**(예: DNA, TV, AI, CEO, FIFA 등)는 **영어 표기를 허용**합니다.
            3. **매력적인 오답**: 정답과 헷갈릴 수 있는 그럴듯한 오답을 배치하세요.
            4. **형식 준수**: 
               - **서론, 결론, 인사말 절대 금지.** 오직 데이터 10줄만 출력하세요.
               - 형식: 문제|정답|오답1|오답2|오답3 

            [나쁜 예시]
            (서론) 네, 알겠습니다. 여기 퀴즈가 있습니다.
            Q: 맨유의 전설적인 공격수는?
            A: Wayne Rooney|Ronaldo|Messi|Park Ji-sung (X - 사람 이름을 영어로 쓰면 안 됨)

            [좋은 예시]
            맨유의 전설적인 공격수는 누구일까요?|웨인 루니|호날두|메시|박지성
            유전 정보를 담고 있는 물질은 무엇인가요?|DNA|RNA|단백질|세포`;

            userPrompt = `[참고 자료]:\n${factContext}\n\n위 자료를 100% 활용하여, 한국인이 풀기에 아주 자연스럽고 재미있는 ${difficulty} 난이도 퀴즈 10개를 만들어주세요.`;

        } else {
            // FALLBACK: Pure AI Generation
            if (lang === 'en') {
                systemPrompt = `You are a professional Quiz Master. Generate 10 high-quality trivia questions in English about "${topic}".
                Format: QUESTION|CORRECT|WRONG1|WRONG2|WRONG3
                No numbering. Exact 10 lines.`;
                
                 let difficultyGuide = "";
                switch (difficulty) {
                    case 'Easy': difficultyGuide = "Level: Easy. Basic facts."; break;
                    case 'Medium': difficultyGuide = "Level: Medium. High school level."; break;
                    case 'Hard': difficultyGuide = "Level: Hard. Expert level."; break;
                    default: difficultyGuide = "Level: Mixed.";
                }

                userPrompt = `Generate 10 ${difficultyGuide} questions about "${topic}".`;
                
            } else {
                // *** STRICT KOREAN MODE (FALLBACK) ***
                systemPrompt = `당신은 대한민국 최고의 예능 퀴즈 작가입니다.
                주어진 주제에 대해 한국인이라면 공감할 수 있는 재미있고 유익한 상식 퀴즈를 만들어주세요.
                
                [절대 규칙]
                1. **서론/결론 금지**: "알겠습니다", "여기 있습니다" 같은 말 절대 쓰지 마세요. 오직 10줄의 퀴즈 데이터만 출력하세요.
                2. 언어: **자연스러운 한국어**를 사용하세요.
                3. **표기법**: 
                   - **사람 이름(예: Einstein), 도시 이름** 등은 무조건 **한글**로 써야 합니다. (아인슈타인 O, Einstein X)
                   - 단, **DNA, UFO, IT, VIP** 처럼 한국인들이 일상적으로 쓰는 **영어 약어는 그대로 사용**해도 됩니다.
                4. 문체: 친근하고 정중한 '해요체' (~인가요? ~은 무엇일까요?)
                5. 형식: 문제|정답|오답1|오답2|오답3 
                
                [예시]
                영국의 축구 스타 웨인 루니가 뛰었던 팀은 어디일까요?|맨체스터 유나이티드|리버풀|첼시|아스날
                우리 몸의 설계도라 불리는 것은?|DNA|RNA|혈액|근육
                유명한 물리학자는 누구인가요?|뉴턴|퀴리|에디슨|테슬라`;
        
                let difficultyGuide = "";
                switch (difficulty) {
                    case 'Easy': difficultyGuide = "난이도: 누구나 맞힐 수 있는 쉬운 상식"; break;
                    case 'Medium': difficultyGuide = "난이도: 알쏭달쏭한 일반 상식"; break;
                    case 'Hard': difficultyGuide = "난이도: 잡학박사 수준의 고난이도 문제"; break;
                    default: difficultyGuide = "난이도: 랜덤";
                }
        
                userPrompt = `주제: "${topic}"\n위 주제로 ${difficultyGuide} 수준의 흥미진진한 퀴즈 10문제를 출제해주세요.`;
            }
        }

        let aiResponse;
        if (aiAvailable) {
            aiResponse = await env.AI.run(model, {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5
            });
        } else {
            // Mock AI Response for Local Testing
            aiResponse = {
                response: `
                한국어 테스트 문제 1|정답|오답1|오답2|오답3
                한국어 테스트 문제 2|정답|오답1|오답2|오답3
                한국어 테스트 문제 3|정답|오답1|오답2|오답3
                한국어 테스트 문제 4|정답|오답1|오답2|오답3
                한국어 테스트 문제 5|정답|오답1|오답2|오답3
                한국어 테스트 문제 6|정답|오답1|오답2|오답3
                한국어 테스트 문제 7|정답|오답1|오답2|오답3
                한국어 테스트 문제 8|정답|오답1|오답2|오답3
                한국어 테스트 문제 9|정답|오답1|오답2|오답3
                한국어 테스트 문제 10|정답|오답1|오답2|오답3
                `
            };
            if (lang === 'en') {
                aiResponse.response = `
                English Test Question 1|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 2|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 3|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 4|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 5|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 6|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 7|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 8|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 9|Correct|Wrong1|Wrong2|Wrong3
                English Test Question 10|Correct|Wrong1|Wrong2|Wrong3
                `;
            }
        }

        let textData = '';
        if (aiResponse && aiResponse.response) {
            textData = aiResponse.response;
        } else {
            textData = JSON.stringify(aiResponse);
        }

        const lines = textData.split('\n').filter(line => line.includes('|'));
        const quizData = [];

        for (const line of lines) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 5) {
                const question = parts[0];
                const correct = parts[1];
                const wrongs = parts.slice(2, 5);
                const answers = [correct, ...wrongs].sort(() => Math.random() - 0.5);

                quizData.push({
                    question: question,
                    answers: answers,
                    correct: correct
                });
            }
        }

        if (quizData.length === 0) {
            console.error("AI Output Parsing Failed:", textData);
            throw new Error("Failed to parse AI output");
        }

        console.log(`Quiz generated successfully using mode: ${promptMode}`);

        let encodedDebug = "";
        try {
            // Safer Base64 Encoding for UTF-8
            const utf8Bytes = new TextEncoder().encode(JSON.stringify(debugLog));
            const binString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join("");
            encodedDebug = btoa(binString);
        } catch (e) {
            console.error("Debug Log Encoding Failed:", e);
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
