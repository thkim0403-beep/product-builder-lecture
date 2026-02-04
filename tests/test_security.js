const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, doc, setDoc } = require("firebase/firestore");

// Config
const firebaseConfig = {
  apiKey: "AIzaSyAO4HT33-jzFI0VKvxGTbrAwCNtNUcpQYY",
  authDomain: "ai-quiz-f8680.firebaseapp.com",
  projectId: "ai-quiz-f8680",
  databaseURL: "https://ai-quiz-f8680-default-rtdb.firebaseio.com",
  storageBucket: "ai-quiz-f8680.firebasestorage.app",
  messagingSenderId: "305663762906",
  appId: "1:305663762906:web:e0f9033fff4f4b1d4660e3"
};

async function testSecurityRules() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("🛡️ Starting Security Rules Verification...");

  // --- Test 1: Invalid Quiz (Missing 'correct' field) ---
  try {
    console.log("\n[TEST 1] Uploading Invalid Quiz (Missing field)...");
    await setDoc(doc(db, "quiz_bank", "malicious_doc"), {
      question: "Hacked?",
      topic: "general"
      // Missing 'correct', 'answers', etc.
    });
    console.log("❌ FAIL: Security rule didn't block invalid quiz!");
  } catch (e) {
    console.log("✅ PASS: Blocked invalid quiz (Permission Denied).");
  }

  // --- Test 2: Abnormal Score (2000 points) ---
  try {
    console.log("\n[TEST 2] Saving Abnormal Score (2000 pts)...");
    await addDoc(collection(db, "scores"), {
      name: "HACKER",
      score: 2000,
      date: new Date()
    });
    console.log("❌ FAIL: Security rule didn't block high score!");
  } catch (e) {
    console.log("✅ PASS: Blocked high score (Permission Denied).");
  }

  // --- Test 3: Normal Score (100 points) ---
  try {
    console.log("\n[TEST 3] Saving Normal Score (100 pts)...");
    await addDoc(collection(db, "scores"), {
      name: "NORMAL",
      score: 100,
      date: new Date()
    });
    console.log("✅ PASS: Normal score saved successfully!");
  } catch (e) {
    console.log(`❌ FAIL: Security rule blocked normal score! (${e.message})`);
  }
}

testSecurityRules();
