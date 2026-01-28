export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic, difficulty = 'Mixed', lang = 'ko' } = await request.json();

        if (!env.AI) {
            return new Response(JSON.stringify({ error: "AI Binding Missing" }), { status: 500 });
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
                    promptMode = 'FORMAT_ONLY'; // Use English questions directly
                }
            } catch (err) {
                console.error("Open Trivia DB Fetch Failed:", err);
            }
        } 
        
        // 2. KOREAN MODE -> Use Naver Open API (Encyclopedia)
        else if (lang === 'ko' && env.NAVER_CLIENT_ID && TOPIC_KEYWORDS[topic]) {
            try {
                const keywords = TOPIC_KEYWORDS[topic];
                // Pick 3 random keywords for variety
                const selectedKeywords = keywords.sort(() => 0.5 - Math.random()).slice(0, 3);
                
                let searchResults = [];
                for (const kw of selectedKeywords) {
                    const naverRes = await fetch(`https://openapi.naver.com/v1/search/encyc.json?query=${encodeURIComponent(kw)}&display=2`, {
                        headers: {
                            "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
                            "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET
                        }
                    });
                    const naverData = await naverRes.json();
                    if (naverData.items && naverData.items.length > 0) {
                        searchResults.push(...naverData.items.map(item => `[키워드: ${kw}] ${item.title.replace(/<[^>]*>?/gm, '')}: ${item.description.replace(/<[^>]*>?/gm, '')}`));
                    }
                }

                if (searchResults.length > 0) {
                    factContext = searchResults.join("\n\n");
                    promptMode = 'NAVER_FACTS';
                }
            } catch (err) {
                console.error("Naver API Fetch Failed:", err);
                // Fallback will be pure generation
            }
        }

        const model = '@cf/meta/llama-3-8b-instruct';
        let systemPrompt = '';
        let userPrompt = '';

        if (promptMode === 'FORMAT_ONLY') {
            // ENGLISH: Reformat Open Trivia DB
            systemPrompt = `You are a quiz formatter. Reformat the provided questions into: QUESTION|CORRECT|WRONG1|WRONG2|WRONG3. No extra text.`;
             const sourceText = sourceQuestions.map((q, i) => {
                return `Q: ${q.question} \nCorrect: ${q.correct_answer} \nWrongs: ${q.incorrect_answers.join(', ')}`;
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
            // FALLBACK: Pure AI Generation (Global Fallback or Keys missing)
            // ... (rest of the code)
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
                // (Existing Korean Generation Logic)
                systemPrompt = `You are a professional Korean quiz master. 
                Your absolute priority is to generate questions in **NATURAL, NATIVE-LEVEL KOREAN**.
                
                CRITICAL RULES:
                1. **NO TRANSLATIONESE**: Do not use awkward translated phrases. Use natural spoken or written Korean.
                2. **Concise Questions**: Keep questions short and clear.
                3. **Plausible Wrong Answers**: Wrong answers must be related to the topic and confusing.
                4. **Format**: QUESTION|CORRECT|WRONG1|WRONG2|WRONG3
                5. **No Extra Text**: Output exactly 10 lines. No numbering.
        
                Bad Example (Don't do this):
                사과에 대한 설명으로 옳은 것은 무엇입니까? (Too stiff)
                
                Good Example (Do this):
                다음 중 사과의 특징으로 알맞은 것은? (Natural)
                `;
        
                let difficultyGuide = "";
                switch (difficulty) {
                    case 'Easy':
                        difficultyGuide = "Difficulty: Easy. Basic facts everyone knows. (초등학생 수준)";
                        break;
                    case 'Medium':
                        difficultyGuide = "Difficulty: Medium. Requires high school level knowledge. (일반 성인 상식 수준)";
                        break;
                    case 'Hard':
                        difficultyGuide = "Difficulty: Hard. Expert knowledge, specific dates/figures. (전문가/매니아 수준)";
                        break;
                    default:
                        difficultyGuide = "Difficulty: Standard balance.";
                }
        
                userPrompt = `Generate 10 multiple-choice quiz questions about "${topic}" in Korean.
                ${difficultyGuide}
                
                Format example:
                이순신 장군이 전사한 해전은?|노량해전|명량해전|한산도대첩|부산포해전
                물의 화학식으로 올바른 것은?|H2O|CO2|O2|NaCl
                
                Now generate 10 questions for topic: "${topic}"`;
            }
        }

        const aiResponse = await env.AI.run(model, {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5 // Lower temperature for translation accuracy
        });

        let textData = '';
        if (aiResponse && aiResponse.response) {
            textData = aiResponse.response;
        } else {
            textData = JSON.stringify(aiResponse);
        }

        // 텍스트를 줄 단위로 분리하여 퀴즈 객체로 변환
        const lines = textData.split('\n').filter(line => line.includes('|'));
        const quizData = [];

        for (const line of lines) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 5) {
                const question = parts[0];
                const correct = parts[1];
                const wrongs = parts.slice(2, 5);
                
                // 정답과 오답을 섞어서 answers 배열 생성
                const answers = [correct, ...wrongs].sort(() => Math.random() - 0.5);

                quizData.push({
                    question: question,
                    answers: answers,
                    correct: correct
                });
            }
        }

        if (quizData.length === 0) {
            // Fallback for parsing failure
            console.error("AI Output Parsing Failed:", textData);
            throw new Error("Failed to parse AI output");
        }

        return new Response(JSON.stringify(quizData), {
            headers: { 'Content-Type': 'application/json' },
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