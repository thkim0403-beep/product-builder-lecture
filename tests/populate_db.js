const { initializeApp } = require("firebase/app");
const { getFirestore, doc, writeBatch, increment } = require("firebase/firestore");
// Node.js Fetch Polyfill (for environments < Node 18 or explicitly safe)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 1. Config (from firebaseConfig.js)
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
const API_URL = "https://product-builder-lecture-dwj.pages.dev/api/generate-quiz";
const TOPICS = ["history", "science", "general", "movies", "sports", "music", "geography"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const LANGS = ["ko", "en"];

// 4. Seeding Function
async function seedDatabase() {
  console.log("🚀 Starting DB Population & Simulation...");
  let totalSaved = 0;

  // Reduced loop for quicker feedback, but enough to generate data
  // User asked for "many", so let's do a decent amount.
  const CYCLES = 3; 

  for (let i = 0; i < CYCLES; i++) { 
    console.log(`\n--- Cycle ${i + 1}/${CYCLES} ---`);
    for (const lang of LANGS) {
        for (const topic of TOPICS) {
        const difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
        
        // Log less verbosely
        process.stdout.write(`Gen: [${lang}] ${topic} `);
        
        try {
            // A. Call API
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

            // B. Save to Firestore (Questions & Stats)
            const batch = writeBatch(db);
            let count = 0;

            data.forEach(q => {
                const safeId = q.question.replace(/[^a-zA-Z0-9가-힣]/g, "").substring(0, 50);
                
                // 1. Save Question to Cache
                const docRef = doc(db, "quiz_bank", safeId);
                batch.set(docRef, {
                    ...q,
                    topic: topic,
                    difficulty: difficulty,
                    lang: lang,
                    createdAt: new Date(),
                    source: "seeding_script"
                });

                // 2. Simulate Solving (Update Stats)
                const isCorrect = Math.random() > 0.3; // 70% Correct Rate
                const statsRef = doc(db, "question_stats", safeId);
                
                // Init if needed (merge)
                batch.set(statsRef, {
                    question: q.question,
                    topic: topic,
                    lastPlayed: new Date()
                }, { merge: true });

                // Update counters
                batch.set(statsRef, {
                    totalAttempts: increment(1),
                    correctCount: increment(isCorrect ? 1 : 0),
                    wrongCount: increment(isCorrect ? 0 : 1)
                }, { merge: true });

                count++;
            });

            await batch.commit();
            console.log(`✅ Saved ${count}`);
            totalSaved += count;

            // C. Politeness Delay
            await new Promise(r => setTimeout(r, 500)); 

        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
        }
    }
  }

  console.log(`\n✨ Finished! Total questions processed: ${totalSaved}`);
  process.exit(0);
}

seedDatabase();

seedDatabase();
