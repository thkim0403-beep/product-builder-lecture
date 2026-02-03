const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, writeBatch } = require("firebase/firestore");

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

async function clearDatabase() {
  console.log("🔥 Starting Database Cleanup...");
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const coll = collection(db, "quiz_bank");
    
    // Get all docs
    const snapshot = await getDocs(coll);
    
    if (snapshot.empty) {
        console.log("✅ Database is already empty.");
        return;
    }

    console.log(`Found ${snapshot.size} documents. Deleting...`);

    // Batch delete (limit 500 per batch)
    const batchSize = 400; 
    let batch = writeBatch(db);
    let count = 0;
    let totalDeleted = 0;

    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            totalDeleted += count;
            console.log(`🗑️ Deleted ${totalDeleted} docs...`);
            batch = writeBatch(db);
            count = 0;
            // Anti-rate limit delay
            await new Promise(r => setTimeout(r, 500));
        }
    }

    if (count > 0) {
        await batch.commit();
        totalDeleted += count;
    }

    console.log(`✨ Cleanup Complete! Deleted ${totalDeleted} questions.`);

  } catch (e) {
    console.error("❌ Error clearing DB:", e.message);
  }
}

clearDatabase();