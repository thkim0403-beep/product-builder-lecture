// functions/api/generate-quiz.js
export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" };

  try {
    const AI = env.AI;
    if (!AI) throw new Error("AI 바인딩을 찾을 수 없습니다.");

    const body = await request.json().catch(() => ({}));
    const topic = body.topic || "일반 상식";
    const lang = body.lang || "ko";

    // 1. AI 호출 - 가장 안정적인 모델 사용
    const response = await AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: "You are a quiz generator. Output ONLY a valid JSON array. No text before or after." },
        { role: "user", content: `Generate 10 quizzes about ${topic} in ${lang}. Format: [{"question":"q","correct":"a","wrong":["w1","w2","w3"]}]` }
      ]
    });

    const aiText = response.response || (response.result && response.result.response) || (typeof response === "string" ? response : "");
    if (!aiText) throw new Error("AI 응답이 비어있습니다.");

    // 2. 파싱 로직 강화
    let quizData = [];
    try {
      const start = aiText.indexOf("[");
      const end = aiText.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        const jsonStr = aiText.substring(start, end + 1).replace(/\n/g, " ");
        quizData = JSON.parse(jsonStr);
      }
    } catch (e) {
      throw new Error(`JSON 파싱 실패: ${aiText.substring(0, 100)}`);
    }

    // 3. 데이터가 없을 경우 방어
    if (!Array.isArray(quizData) || quizData.length === 0) {
      throw new Error("생성된 퀴즈가 배열 형식이 아닙니다.");
    }

    // 4. 최종 변환 (최대 10개)
    const result = quizData.slice(0, 10).map(q => ({
      question: q.question || "질문 없음",
      correct: q.correct || "정답 없음",
      answers: [q.correct, ...(q.wrong || [])].filter(Boolean).sort(() => Math.random() - 0.5)
    }));

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (err) {
    // 에러 발생 시 1개의 문제 객체에 에러 내용을 담아 반환 (Saved 1 items의 원인)
    return new Response(JSON.stringify([{
      question: `에러 발생: ${err.message}`,
      correct: "확인",
      answers: ["확인", "재시도", "설정체크", "대기"]
    }]), { status: 200, headers });
  }
}
