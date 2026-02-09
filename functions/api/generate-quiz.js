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
    if (!AI) throw new Error("AI binding not found.");

    const body = await request.json().catch(() => ({}));
    const topic = body.topic || "일반 상식";
    const lang = body.lang || "ko";
    const difficulty = body.difficulty || "Medium";

    log(`Gen Start: ${topic} | ${lang} | ${difficulty}`);

    const MODELS = [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3-8b-instruct",
      "@cf/meta/llama-3.2-3b-instruct"
    ];

    let aiText = "";
    let usedModel = "";

    for (const model of MODELS) {
      try {
        log(`Trying ${model}`);
        const response = await AI.run(model, {
          messages: [
            { 
              role: "system", 
              content: "You are a quiz generator. Output ONLY a JSON array. Avoid using double quotes inside strings; use single quotes if needed. Example: {\"question\": \"Who wrote 'War and Peace'?\", ...}" 
            },
            { 
              role: "user", 
              content: `Create 5 ${difficulty} level quizzes about ${topic} in ${lang}. Format: [{"question":"...","correct":"...","wrong":["...","...","..."]}]` 
            }
          ],
          temperature: 0.5
        });

        const text = response.response || (response.result && response.result.response) || (typeof response === "string" ? response : "");
        if (text && text.trim()) {
          aiText = text.replace(/```json/g, "").replace(/```/g, "").trim();
          usedModel = model;
          log(`Model ${model} success`);
          break;
        }
      } catch (e) { log(`Model ${model} failed: ${e.message}`); }
    }

    if (!aiText) throw new Error("AI failed to respond.");

    // --- High Resilience JSON Parsing ---
    let quizData = [];
    
    // Attempt 1: Standard Parse
    try {
      const start = aiText.indexOf("[");
      const end = aiText.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        let clean = aiText.substring(start, end + 1)
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
          .replace(/,\s*([\]}])/g, "$1");
        quizData = JSON.parse(clean);
      }
    } catch (e) {
      log("Standard parse failed. Trying Regex extraction...");
      
      // Attempt 2: Extract individual objects {...}
      const objectMatches = aiText.match(/\{[^{}]*?"question"[^{}]*?\}/gs);
      if (objectMatches) {
        for (const objStr of objectMatches) {
          try {
            // Basic cleanup for each object
            let cleanObj = objStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/,\s*\}/g, "}");
            quizData.push(JSON.parse(cleanObj));
          } catch (objErr) { /* Skip broken objects */ }
        }
      }
    }

    if (!Array.isArray(quizData) || quizData.length === 0) {
      log(`Full Text: ${aiText.substring(0, 500)}`);
      throw new Error("Failed to extract any valid quiz objects.");
    }

    // --- Validation & Formatting ---
    const finalResult = quizData.map(q => {
      if (!q.question || !q.correct) return null;
      const correct = String(q.correct);
      const wrong = Array.isArray(q.wrong) ? q.wrong.map(String) : [];
      const uniqueWrong = [...new Set(wrong)].filter(w => w !== correct).slice(0, 3);
      while (uniqueWrong.length < 3) uniqueWrong.push(`Option ${uniqueWrong.length + 1}`);
      
      return {
        question: String(q.question),
        correct: correct,
        answers: [correct, ...uniqueWrong].sort(() => Math.random() - 0.5)
      };
    }).filter(Boolean).slice(0, 10);

    if (finalResult.length === 0) throw new Error("No valid quizzes after validation.");

    const debugHeader = btoa(unescape(encodeURIComponent(JSON.stringify({ model: usedModel, logs: debugLogs }))));
    return new Response(JSON.stringify(finalResult), { 
      status: 200, 
      headers: { ...headers, "X-Debug-Log": debugHeader } 
    });

  } catch (err) {
    log(`Fatal: ${err.message}`);
    const debugHeader = btoa(unescape(encodeURIComponent(JSON.stringify({ logs: debugLogs }))));
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...headers, "X-Debug-Log": debugHeader } 
    });
  }
}
