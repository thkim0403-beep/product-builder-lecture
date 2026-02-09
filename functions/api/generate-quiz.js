// functions/api/generate-quiz.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = { 
    "Content-Type": "application/json; charset=utf-8", 
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "X-Debug-Log"
  };

  const debugLogs = [];
  const log = (msg) => {
    console.log(msg);
    debugLogs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const AI = env.AI;
    if (!AI) throw new Error("AI binding not found in environment.");

    const body = await request.json().catch(() => ({}));
    const topic = body.topic || "일반 상식";
    const lang = body.lang || "ko";
    const difficulty = body.difficulty || "Medium";

    log(`Starting Quiz Gen: topic=${topic}, lang=${lang}, difficulty=${difficulty}`);

    const MODELS = [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3-8b-instruct",
      "@cf/meta/llama-3.2-3b-instruct",
      "@cf/mistral/mistral-7b-instruct-v0.1"
    ];

    let aiText = "";
    let usedModel = "";

    for (const model of MODELS) {
      try {
        log(`Trying model: ${model}`);
        const response = await AI.run(model, {
          messages: [
            { 
              role: "system", 
              content: "You are a professional quiz generator. Output ONLY a valid JSON array. No markdown, no conversational text. Format: [{\"question\":\"...\",\"correct\":\"...\",\"wrong\":[\"...\",\"...\",\"...\"]}]" 
            },
            { 
              role: "user", 
              content: `Generate 10 high-quality multiple-choice quizzes about ${topic} in ${lang} language. Difficulty: ${difficulty}. Ensure exactly 3 wrong answers for each question.` 
            }
          ],
          temperature: 0.7
        });

        const text = response.response || (response.result && response.result.response) || (typeof response === "string" ? response : "");
        if (text && text.trim()) {
          aiText = text;
          usedModel = model;
          log(`Success with model ${model}`);
          break;
        }
      } catch (e) {
        log(`Model ${model} failed: ${e.message}`);
      }
    }

    if (!aiText) throw new Error("All AI models failed to provide a response.");

    // 2. 파싱 로직 강화
    let quizData = [];
    try {
      const start = aiText.indexOf("[");
      const end = aiText.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        const jsonStr = aiText.substring(start, end + 1).replace(/\n/g, " ");
        quizData = JSON.parse(jsonStr);
      } else {
        throw new Error("No JSON array found in AI output.");
      }
    } catch (e) {
      log(`JSON Parse Error: ${e.message}. Raw: ${aiText.substring(0, 100)}...`);
      throw new Error(`AI output parsing failed: ${e.message}`);
    }

    if (!Array.isArray(quizData) || quizData.length === 0) {
      throw new Error("Generated data is not a valid array.");
    }

    // 3. 최종 변환 및 유효성 검사
    const result = quizData.slice(0, 10).map(q => {
      if (!q.question || !q.correct) return null;
      const wrong = Array.isArray(q.wrong) ? q.wrong : [];
      return {
        question: q.question,
        correct: q.correct,
        answers: [q.correct, ...wrong].filter(Boolean).sort(() => Math.random() - 0.5)
      };
    }).filter(Boolean);

    if (result.length === 0) throw new Error("No valid quiz items remained after filtering.");

    const debugHeader = btoa(unescape(encodeURIComponent(JSON.stringify({ model: usedModel, logs: debugLogs }))));

    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { ...headers, "X-Debug-Log": debugHeader } 
    });

  } catch (err) {
    log(`Fatal: ${err.message}`);
    const debugHeader = btoa(unescape(encodeURIComponent(JSON.stringify({ logs: debugLogs }))));
    
    // 에러 발생 시 500 코드를 반환하여 클라이언트에서 재시도하게 함
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...headers, "X-Debug-Log": debugHeader } 
    });
  }
}
