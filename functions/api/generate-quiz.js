export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic } = await request.json();

        if (!env.AI) {
            return new Response(JSON.stringify({ 
                error: "AI Binding Missing", 
                detail: "Cloudflare 대시보드에서 'AI' 바인딩이 설정되지 않았습니다. Variable name이 대문자 'AI'인지 확인해주세요." 
            }), { status: 500 });
        }

        // Llama 3 모델 사용 (더 빠르고 정확함)
        const model = '@cf/meta/llama-3-8b-instruct';
        
        const systemPrompt = "You are a quiz generator. Output ONLY a raw JSON array. No conversational text, no markdown blocks. The output must be exactly 10 items.";
        const userPrompt = `Generate 10 quiz questions about "${topic}" in Korean. 
        Format: [{"question":"...", "answers":["","","",""], "correct":"..."}]`;

        const aiResponse = await env.AI.run(model, {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        let jsonText = '';
        if (aiResponse && aiResponse.response) {
            jsonText = aiResponse.response;
        } else if (typeof aiResponse === 'string') {
            jsonText = aiResponse;
        } else {
            jsonText = JSON.stringify(aiResponse);
        }

        // JSON만 추출하기 위한 정규식 (마크다운 블록 제거)
        const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error("AI did not return a valid JSON array.");
        }
        
        const quizData = JSON.parse(jsonMatch[0]);

        return new Response(JSON.stringify(quizData), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        return new Response(JSON.stringify({ 
            error: "Server-side Error", 
            message: e.message,
            stack: e.stack
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}