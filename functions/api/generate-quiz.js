export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic } = await request.json();

        if (!env.AI) {
            return new Response(JSON.stringify({ error: "AI Binding Missing" }), { status: 500 });
        }

        // Llama 3 8B Instruct 모델 사용
        const model = '@cf/meta/llama-3-8b-instruct';
        
        const systemPrompt = `You are a strict JSON generator. You must output ONLY a valid JSON array of objects. 
        Do not include markdown code blocks (like 
```json
). Do not add any conversational text.
        Ensure all strings are properly escaped.`;

        const userPrompt = `Create 10 multiple-choice quiz questions about "${topic}" in Korean.
        
        Follow this EXACT JSON format:
        [
          {
            "question": "What is 1+1?",
            "answers": ["1", "2", "3", "4"],
            "correct": "2"
          }
        ]
        
        Generate exactly 10 questions.`;

        const aiResponse = await env.AI.run(model, {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            // max_tokens를 늘려서 응답이 잘리지 않게 함
            max_tokens: 2000, 
            temperature: 0.5 // 창의성을 낮춰서 형식을 더 잘 지키게 함
        });

        let jsonText = '';
        if (aiResponse && aiResponse.response) {
            jsonText = aiResponse.response;
        } else if (typeof aiResponse === 'string') {
            jsonText = aiResponse;
        } else {
            jsonText = JSON.stringify(aiResponse);
        }

        // 1. 마크다운 코드 블록 제거
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
        
        // 2. 앞뒤 공백 및 불필요한 텍스트 제거 (대괄호 찾기)
        const firstBracket = jsonText.indexOf('[');
        const lastBracket = jsonText.lastIndexOf(']');
        
        if (firstBracket !== -1 && lastBracket !== -1) {
            jsonText = jsonText.substring(firstBracket, lastBracket + 1);
        } else {
            throw new Error("No JSON array found in AI response");
        }

        try {
            const quizData = JSON.parse(jsonText);
            return new Response(JSON.stringify(quizData), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (jsonError) {
            // 파싱 실패 시, 원본 텍스트를 로그에 남겨서 디버깅
            console.error("JSON Parse Error. Raw text:", jsonText);
            throw new Error(`Invalid JSON format: ${jsonError.message}`);
        }

    } catch (e) {
        return new Response(JSON.stringify({
            error: e.message,
            stack: e.stack
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
