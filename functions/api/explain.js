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

        const runAI = async (system, user, temp = 0.5) => {
            if (!env.AI) return null;
            const MODELS = [
                '@cf/meta/llama-3.1-8b-instruct',
                '@cf/meta/llama-3-8b-instruct',
                '@cf/meta/llama-3.2-3b-instruct',
                '@cf/mistral/mistral-7b-instruct-v0.1'
            ];

            for (const model of MODELS) {
                try {
                    const response = await env.AI.run(model, {
                        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
                        temperature: temp
                    });
                    
                    if (response) {
                        return response.response || (response.result && response.result.response) || (typeof response === 'string' ? response : JSON.stringify(response));
                    }
                } catch (e) { console.error(`Failed ${model}: ${e.message}`); }
            }
            return null;
        };

        let systemPrompt = "";
        let userPrompt = "";

        if (lang === 'ko') {
            systemPrompt = `당신은 퀴즈 해설 작가입니다. 틀린 문제에 대해 친근한 '해요체'로 해설해 주세요. 정답 텍스트를 반드시 포함하세요.`;
            userPrompt = wrongAnswers.map(wa => `질문: "${wa.question}" / 정답: "${wa.correct}"`).join('\n');
        } else {
            systemPrompt = "Explain briefly why the correct answer is right. Use English.";
            userPrompt = wrongAnswers.map(wa => `Question: "${wa.question}" / Correct Answer: "${wa.correct}"`).join('\n');
        }

        let explanation = await runAI(systemPrompt, userPrompt);
        if (!explanation) explanation = "Failed to generate explanation.";

        return new Response(JSON.stringify({ explanation }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}