export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic } = await request.json();

        if (!topic) {
            return new Response('Missing topic in request body', { status: 400 });
        }

        // AI 바인딩 확인
        if (!env.AI) {
            console.error("AI Binding is MISSING. Check Cloudflare Dashboard Settings.");
            throw new Error('AI binding not found on server.');
        }

        const prompt = `
            Generate 10 quiz questions about "${topic}" in Korean.
            The response MUST be a raw JSON array. Do NOT use Markdown code blocks.
            Format:
            [
              {
                "question": "Question text",
                "answers": ["Option1", "Option2", "Option3", "Option4"],
                "correct": "Correct Option"
              }
            ]
        `;

        console.log(`Requesting AI for topic: ${topic}`);

        const aiResponse = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: prompt,
        });

        console.log("Raw AI Response:", JSON.stringify(aiResponse));

        // AI 응답 처리
        let jsonResponse = '';
        if (aiResponse && typeof aiResponse === 'object') {
            // response 프로퍼티가 있으면 사용, 없으면 전체를 문자열로 간주 시도
            jsonResponse = aiResponse.response || JSON.stringify(aiResponse);
        } else {
            jsonResponse = String(aiResponse);
        }

        // Markdown 코드 블록 제거 (```json ... ```)
        jsonResponse = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        // 유효한 JSON인지 확인
        let quiz;
        try {
            quiz = JSON.parse(jsonResponse);
        } catch (jsonError) {
            console.error("JSON Parse Error. Invalid string:", jsonResponse);
            throw new Error(`Failed to parse AI response: ${jsonError.message}`);
        }

        return new Response(JSON.stringify(quiz), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        console.error("Server Error:", e);
        return new Response(JSON.stringify({ 
            error: e.message, 
            stack: e.stack 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
