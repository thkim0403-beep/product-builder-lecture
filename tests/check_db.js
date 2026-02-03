const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getCountFromServer } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAO4HT33-jzFI0VKvxGTbrAwCNtNUcpQYY",
  authDomain: "ai-quiz-f8680.firebaseapp.com",
  projectId: "ai-quiz-f8680",
  databaseURL: "https://ai-quiz-f8680-default-rtdb.firebaseio.com",
  storageBucket: "ai-quiz-f8680.firebasestorage.app",
  messagingSenderId: "305663762906",
  appId: "1:305663762906:web:e0f9033fff4f4b1d4660e3"
};

async function checkDB() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const coll = collection(db, "quiz_bank");
    
    console.log("Checking DB connection...");
    const snapshot = await getCountFromServer(coll);
    console.log(`
📊 Total Questions in DB: ${snapshot.data().count}`);
    
    if (snapshot.data().count > 0) {
        console.log("✅ Data population was successful (at least partially).");
    } else {
        console.log("⚠️ No questions found. The population script might have failed.");
    }
  } catch (e) {
    console.error("❌ DB Connection Failed:", e.message);
  }
}

checkDB();
