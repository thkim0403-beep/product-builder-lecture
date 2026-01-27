export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic } = await request.json();

        if (!topic) {
            return new Response('Missing topic in request body', { status: 400 });
        }

        // AI 바인딩이 설정되어 있는지 확인
        if (!env.AI) {
            throw new Error('AI binding not found. Please configure "AI" binding in Cloudflare Pages settings.');
        }

        const prompt = `
            Generate 10 quiz questions about "${topic}".
            The response must be a valid JSON array of objects. Do not include any text outside of the JSON array.
            Each object in the array must have the following structure:
            {
                "question": "Your question here",
                "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"],
                "correct": "The correct answer"
            }
        `;

        const aiResponse = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: prompt,
        });

        // AI 응답 파싱 (Markdown 코드 블록 제거 등)
        let jsonResponse = '';
        if (aiResponse && aiResponse.response) {
            jsonResponse = aiResponse.response.trim();
        } else {
             // AI 응답 구조가 다를 경우를 대비한 직접 접근
             jsonResponse = JSON.stringify(aiResponse).trim();
        }

        if (jsonResponse.startsWith('```json')) {
            jsonResponse = jsonResponse.substring(7, jsonResponse.length - 3).trim();
        } else if (jsonResponse.startsWith('`')) {
            jsonResponse = jsonResponse.substring(1, jsonResponse.length - 1).trim();
        }

        // 유효한 JSON인지 확인
        let quiz;
        try {
            quiz = JSON.parse(jsonResponse);
        } catch (jsonError) {
            console.error("JSON Parse Error:", jsonResponse);
            return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: jsonResponse }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(quiz), {
            headers: {
                'Content-Type': 'application/json'
            },
        });

    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
