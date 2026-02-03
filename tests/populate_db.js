const { initializeApp } = require("firebase/app");
const { getFirestore, doc, writeBatch, increment } = require("firebase/firestore");
// Node.js Fetch Polyfill
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 1. Config
const firebaseConfig = {
  apiKey: "AIzaSyAO4HT33-jzFI0VKvxGTbrAwCNtNUcpQYY",
  authDomain: "ai-quiz-f8680.firebaseapp.com",
  projectId: "ai-quiz-f8680",
  databaseURL: "https://ai-quiz-f8680-default-rtdb.firebaseio.com",
  storageBucket: "ai-quiz-f8680.firebasestorage.app",
  messagingSenderId: "305663762906",
  appId: "1:305663762906:web:e0f9033fff4f4b1d4660e3"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Configuration
const API_URL = "http://127.0.0.1:8787/api/generate-quiz";
const TOPICS = ["history", "science", "general"];
const DIFFICULTIES = ["Medium"];
const LANGS = ["ko"];
const TARGET_PER_TOPIC = 20; // 주제당 20개씩 생성
const QUESTIONS_PER_CALL = 10; // 1회 호출당 생성 개수

// 4. Seeding Function
async function seedDatabase() {
  console.log(`🚀 Starting Bulk DB Population: Target ${TARGET_PER_TOPIC} per topic...`);
  let totalSaved = 0;

  for (const lang of LANGS) {
    for (const topic of TOPICS) {
      console.log(`
--- Target: [${lang}] ${topic} (Goal: ${TARGET_PER_TOPIC}) ---`);
      
      let topicCount = 0;
      const iterations = Math.ceil(TARGET_PER_TOPIC / QUESTIONS_PER_CALL);

      for (let i = 0; i < iterations; i++) {
        const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]; // 순차적으로 난이도 배분
        
        process.stdout.write(`  [${i + 1}/${iterations}] Gen: ${difficulty}... `);
        
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, difficulty, lang })
          });

          if (!response.ok) {
            console.log(`❌ API ${response.status}`);
            continue;
          }

          const data = await response.json();
          if (!Array.isArray(data) || data.length === 0) {
            console.log("⚠️ No Data");
            continue;
          }

          const batch = writeBatch(db);
          let callCount = 0;

          data.forEach(q => {
            const safeId = `${lang}_${topic}_` + q.question.replace(/[^a-zA-Z0-9가-힣]/g, "").substring(0, 50);
            
            // 1. Save Question
            const docRef = doc(db, "quiz_bank", safeId);
            batch.set(docRef, {
              ...q,
              topic: topic,
              difficulty: difficulty,
              lang: lang,
              createdAt: new Date(),
              source: "bulk_seeding_script"
            }, { merge: true });

            // 2. Stats Simulation
            const statsRef = doc(db, "question_stats", safeId);
            const isCorrect = Math.random() > 0.3;
            batch.set(statsRef, {
              question: q.question,
              topic: topic,
              lastPlayed: new Date(),
              totalAttempts: increment(1),
              correctCount: increment(isCorrect ? 1 : 0),
              wrongCount: increment(isCorrect ? 0 : 1)
            }, { merge: true });

            callCount++;
          });

          await batch.commit();
          topicCount += callCount;
          totalSaved += callCount;
          console.log(`✅ +${callCount} (Topic Total: ${topicCount})`);

          // API rate limit 방지를 위한 짧은 대기
          await new Promise(r => setTimeout(r, 1000)); 
        } catch (e) {
          console.log(`❌ Error: ${e.message}`);
        }
      }
    }
  }

  console.log(`
✨ Finished! Total questions processed: ${totalSaved}`);
  process.exit(0);
}

seedDatabase();