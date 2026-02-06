// functions/api/generate-quiz.js
export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const AI = env.AI;
    if (!AI) {
      return new Response(JSON.stringify([{
        question: `환경 변수 오류: AI 바인딩이 없습니다. 현재 변수: ${Object.keys(env).join(", ")}`,
        correct: "확인", answers: ["확인", "설정필요", "대기", "오류"]
      }]), { status: 200, headers });
    }

    const body = await request.json().catch(() => ({}));
    const topic = body.topic || "일반 상식";
    const lang = body.lang || "ko";

    let aiText = "";
    // 안정성을 위해 두 가지 모델 시도
    const models = ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3-8b-instruct"];
    
    for (const model of models) {
      try {
        const result = await AI.run(model, {
          messages: [
            { role: "system", content: "You are a quiz master. Output ONLY a valid JSON array. No chatter." },
            { role: "user", content: `Topic: ${topic}. Language: ${lang}. Create 10 quizzes. Format: [{"question":"","correct":"","wrong":["","",""]}]` }
          ]
        });
        aiText = result.response || (result.result && result.result.response) || (typeof result === "string" ? result : "");
        if (aiText && aiText.includes("[")) break;
      } catch (e) {
        console.error(`${model} failed: ${e.message}`);
      }
    }

    if (!aiText) throw new Error("AI 모델이 응답을 주지 않습니다.");

    let quizData = [];
    try {
      // JSON 파싱 방해 요소 제거
      let cleanJson = aiText.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
      const start = cleanJson.indexOf("[");
      const end = cleanJson.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        quizData = JSON.parse(cleanJson.substring(start, end + 1));
      } else {
        throw new Error(`JSON 형식을 찾을 수 없음. 응답내용: ${aiText.substring(0, 50)}...`);
      }
    } catch (pErr) {
      throw new Error(`파싱 에러: ${pErr.message}`);
    }

    if (!Array.isArray(quizData) || quizData.length === 0) throw new Error("데이터가 배열 형식이 아닙니다.");

    const final = quizData.slice(0, 10).map(q => ({
      question: q.question || "내용 없음",
      correct: q.correct || "정답 없음",
      answers: [q.correct || "정답", ...(q.wrong || ["오답1", "오답2", "오답3"])].sort(() => Math.random() - 0.5)
    }));

    return new Response(JSON.stringify(final), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify([{
      question: `상세 오류: ${err.message}`,
      correct: "확인", answers: ["확인", "재시도", "로그확인", "안내"]
    }]), { status: 200, headers });
  }
}