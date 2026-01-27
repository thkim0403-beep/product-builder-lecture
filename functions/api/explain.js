export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { wrongAnswers } = await request.json();

        if (!wrongAnswers || wrongAnswers.length === 0) {
            return new Response(JSON.stringify({ explanation: "모든 문제를 맞히셨습니다! 완벽합니다!" }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!env.AI) {
            throw new Error('AI binding not found.');
        }

        const prompt = `
            사용자가 퀴즈에서 다음 문제들을 틀렸습니다. 각 문제에 대해 정답이 왜 정답인지 친절하고 짧게 해설해주세요.
            형식: 
            - 문제: [질문]
            - 해설: [설명]

            틀린 문제들:
            ${wrongAnswers.map(wa => `질문: ${wa.question}, 정답: ${wa.correct}`).join('\n')}
        `;

        const aiResponse = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: prompt,
        });

        const explanation = aiResponse.response || "해설을 생성할 수 없습니다.";

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
