export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { wrongAnswers, lang = 'ko' } = await request.json();

        if (!wrongAnswers || wrongAnswers.length === 0) {
            const msg = lang === 'ko' ? "모든 문제를 맞히셨습니다! 완벽합니다! 🎉" : "Perfect score! You got everything right! 🎉";
            return new Response(JSON.stringify({ explanation: msg }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let aiAvailable = true;
        if (!env.AI) {
            console.warn('AI binding not found. Using Mock Explanation.');
            aiAvailable = false;
        }

        let systemPrompt = "";
        let userPrompt = "";

        if (lang === 'ko') {
            systemPrompt = `당신은 대한민국 인기 TV 예능 프로그램의 메인 퀴즈 작가입니다.
            참가자가 틀린 문제에 대해, 정답이 왜 정답인지 **친근하고 재치 있는 '해요체'**로 해설해 주세요.

            [필수 원칙]
            1. **용어 통일**: 입력으로 제공된 **'정답' 텍스트를 그대로 사용**하세요. 절대 영어로 다시 번역하거나 다른 말로 바꾸지 마세요. (예: 정답이 '이순신'이면 설명에서도 '이순신'이라고 해야 함)
            2. **표기법**: 설명 중간에 인명/지명이 나올 경우 반드시 **한글**로 표기하세요. (영어 사용 금지)
            3. **문체**: 딱딱한 설명 대신, "아쉽네요! 정답은 ~에요. 왜냐하면 ~" 처럼 대화하듯 자연스럽게 작성하세요.
            
            [형식]
            Q: [문제 내용]
            A: [정답 텍스트] - [재치 있는 해설 (한 문장)]`;

            userPrompt = `
            다음 오답 노트에 대한 해설을 작성해주세요.
            
            [틀린 문제 목록]
            ` + wrongAnswers.map(wa => `질문: "${wa.question}" / 정답: "${wa.correct}"`).join('\n');
        } else {
            systemPrompt = "You are a helpful quiz tutor. Explain briefly why the correct answer is right for each question the user missed. Use English only.";
            userPrompt = `
            Please provide explanations for these missed questions.
            
            [Format]
            Q: [Question Summary]
            A: [Correct Answer] - [Brief Explanation]

            [Missed Questions]
            ` + wrongAnswers.map(wa => `Question: "${wa.question}" / Correct Answer: "${wa.correct}"`).join('\n');
        }

        const model = '@cf/meta/llama-3-8b-instruct';
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
            aiResponse = {
                response: lang === 'ko' ? 
                "AI 연결이 되지 않아 자동 생성된 해설입니다. 정답은 문맥을 통해 확인할 수 있습니다." : 
                "This is a mock explanation because AI connection is unavailable."
            };
        }

        let explanation = "";
        if (aiResponse && aiResponse.response) {
            explanation = aiResponse.response;
        } else {
            explanation = JSON.stringify(aiResponse);
        }

        return new Response(JSON.stringify({ explanation }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });

    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}