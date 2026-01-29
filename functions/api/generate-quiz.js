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
            1. **문체**: 딱딱한 교과서 말투가 아닌, 예능 자막처럼 자연스럽고 친근한 **'해요체'**를 사용하세요. (번역투 절대 금지)
            2. **질문 품질**: 단순히 단어의 뜻을 묻기보다, 상황이나 흥미로운 사실을 퀴즈로 만드세요.
            3. **매력적인 오답**: 정답과 전혀 상관없는 엉뚱한 단어 대신, **정답과 헷갈릴 수 있는 그럴듯한 오답**을 배치하세요.
            4. **형식 준수**: 문제|정답|오답1|오답2|오답3 (정확히 10줄)

            [나쁜 예시]
            이순신에 대하여 맞는 것은?|장군|왕|신하|시민 (질문이 건조하고 보기가 너무 단순함)

            [좋은 예시]
            임진왜란 당시 거북선을 이끌고 왜군을 물리친 조선의 명장, '성웅'이라 불리는 이 사람은 누구일까요?|이순신|강감찬|을지문덕|권율`;

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
                1. 언어: **원어민 수준의 완벽하고 자연스러운 한국어**만 사용하세요. (영어 섞어 쓰기, 번역투 금지)
                2. 문체: 친근하고 정중한 '해요체' (~인가요? ~은 무엇일까요?)
                3. 오답(Distractors): 초등학생이 봐도 답을 알 수 있는 쉬운 오답은 피하고, 헷갈리는 그럴듯한 단어를 섞으세요.
                4. 형식: 문제|정답|오답1|오답2|오답3 (정확히 10줄)
                
                [예시]
                Q: 한국인이 가장 사랑하는 야식으로, '치느님'이라고도 불리는 음식은?
                A: 치킨|피자|족발|보쌈 (O)
                
                Q: Food called God of Chicken?
                A: Chicken|Pizza (X - 영어 사용 금지)`;
        
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

        return new Response(JSON.stringify(quizData), {
            headers: { 
                'Content-Type': 'application/json; charset=utf-8',
                'X-Quiz-Source': promptMode,
                'X-Debug-Log': btoa(unescape(encodeURIComponent(JSON.stringify(debugLog)))) 
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
