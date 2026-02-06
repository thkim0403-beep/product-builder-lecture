// functions/api/generate-quiz.js
export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // 1. AI 바인딩 찾기 (이름이 대소문자 다르거나 다른 이름일 경우 대비)
    const AI = env.AI || env.ai || env.Ai;
    
    if (!AI) {
      return new Response(JSON.stringify([{
        question: "오류: AI 바인딩을 찾을 수 없습니다. (환경변수: " + Object.keys(env).join(", ") + ")",
        correct: "확인",
        answers: ["확인", "바인딩체크", "설정", "대기"]
      }]), { status: 200, headers });
    }

    // 2. 입력 데이터 처리
    const body = await request.json().catch(() => ({}));
    const topic = body.topic || "일반 상식";
    const lang = body.lang || "ko";

    // 3. AI 실행
    const model = "@cf/meta/llama-3.1-8b-instruct";
    const result = await AI.run(model, {
      messages: [
        { role: "system", content: "You are a quiz master. Output ONLY a valid JSON array." },
        { role: "user", content: `Create 10 quizzes about ${topic} in ${lang}. Format: [{"question":"","correct":"","wrong":["","",""]}]` }
      ]
    });

    const text = result.response || (result.result && result.result.response) || (typeof result === "string" ? result : "");
    let quizData = [];
    
    if (text) {
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        quizData = JSON.parse(text.substring(start, end + 1));
      }
    }

    if (!quizData.length) throw new Error("AI 응답 파싱 실패");

    const final = quizData.map(q => ({
      question: q.question,
      correct: q.correct,
      answers: [q.correct, ...(q.wrong || [])].sort(() => Math.random() - 0.5)
    }));

    return new Response(JSON.stringify(final), { status: 200, headers });

  } catch (err) {
    // 에러 발생 시 에러 내용을 상세히 출력 (500 에러 방지)
    return new Response(JSON.stringify([{
      question: `시스템 오류 발생: ${err.message}`,
      correct: "확인",
      answers: ["확인", "로그확인", "재시도", "안내"]
    }]), { status: 200, headers });
  }
}
