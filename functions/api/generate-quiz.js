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
            systemPrompt = `당신은 대한민국 최고의 퀴즈 전문가입니다.
            제공된 백과사전 내용을 바탕으로 창의적이고 재미있는 객관식 퀴즈 10문제를 만드세요.
            
            규칙:
            1. 반드시 제공된 [사실]에 기반하여 문제를 출제하세요.
            2. **형식**: 문제|정답|오답1|오답2|오답3
            3. 문체: 자연스럽고 정중한 한국어 (해요체). 번역투 금지.
            4. 오답은 헷갈리지만 명확히 틀린 내용이어야 합니다.
            5. 정확히 10줄만 출력하세요.`;

            userPrompt = `[참고 자료 - 네이버 백과사전]:\n${factContext}\n\n위 자료를 바탕으로 ${difficulty} 난이도의 한국어 퀴즈 10문제를 만들어주세요.`;

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
                // *** STRICT KOREAN MODE ***
                systemPrompt = `당신은 영어를 전혀 할 줄 모르는 순수 토종 한국인 퀴즈 출제자입니다.
                당신의 임무는 오직 '한국어'로만 퀴즈를 만드는 것입니다. 영어는 절대 사용하지 마세요.
                
                [절대 규칙]
                1. 모든 질문, 정답, 오답은 반드시 **한국어(Korean)**여야 합니다.
                2. 질문 형식: "~은 무엇인가요?", "~로 알맞은 것은?" (자연스러운 해요체)
                3. 출력 형식: 문제|정답|오답1|오답2|오답3
                4. 번역투 문장(~에 대하여 등)을 쓰면 해고됩니다.
                5. 정확히 10줄만 출력하세요.`;
        
                let difficultyGuide = "";
                switch (difficulty) {
                    case 'Easy': difficultyGuide = "난이도: 쉬움 (초등학생 수준)"; break;
                    case 'Medium': difficultyGuide = "난이도: 보통 (일반인 상식)"; break;
                    case 'Hard': difficultyGuide = "난이도: 어려움 (전문가 수준)"; break;
                    default: difficultyGuide = "난이도: 랜덤";
                }
        
                userPrompt = `주제: "${topic}"에 대한 한국어 객관식 퀴즈 10개를 만들어주세요.
                ${difficultyGuide}
                
                예시:
                임진왜란 때 활약한 거북선을 만든 사람은?|이순신|장영실|세종대왕|안중근
                물의 화학식은 무엇인가요?|H2O|CO2|NaCl|O2
                
                위 예시처럼 완벽한 한국어로 출력하세요. 영어 금지.`;
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
                'Content-Type': 'application/json',
                'X-Quiz-Source': promptMode,
                'X-Debug-Log': JSON.stringify(debugLog) 
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
