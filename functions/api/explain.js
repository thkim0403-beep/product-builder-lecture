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
            systemPrompt = "당신은 친절한 한국어 퀴즈 선생님입니다. 사용자가 틀린 문제에 대해 왜 그것이 정답인지 짧고 명쾌하게 설명해주세요. 한국어로만 답변하세요.";
            userPrompt = `
            다음 오답 노트에 대한 해설을 작성해주세요.
            
            [형식]
            Q: [문제 요약]
            A: [정답] - [이유 설명 (한 문장)]

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
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}