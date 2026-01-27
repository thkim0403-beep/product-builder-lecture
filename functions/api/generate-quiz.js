export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { topic } = await request.json();

        if (!env.AI) {
            return new Response(JSON.stringify({ error: "AI Binding Missing" }), { status: 500 });
        }

        const model = '@cf/meta/llama-3-8b-instruct';
        
        // JSON 대신 단순 텍스트 형식으로 요청 (파이프라인 | 구분자 사용)
        const systemPrompt = `You are a quiz generator. Output ONLY the questions in a specific format.
        Format per line: QUESTION|CORRECT_ANSWER|WRONG1|WRONG2|WRONG3
        Do not add any numbers, bullets, or extra text. Generate exactly 10 lines.`;

        const userPrompt = `Generate 10 quiz questions about "${topic}" in Korean.
        Example output:
        1+1은?|2|1|3|4
        한국의 수도는?|서울|부산|대구|인천`;

        const aiResponse = await env.AI.run(model, {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7 // 약간의 창의성 허용
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
            throw new Error("Failed to parse any quiz questions from AI text.");
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