const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, writeBatch } = require("firebase/firestore");

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

async function deduplicateDatabase() {
  console.log("🧹 Starting Duplicate Cleanup...");
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const coll = collection(db, "quiz_bank");
    
    const snapshot = await getDocs(coll);
    if (snapshot.empty) {
        console.log("✅ Database is empty. No duplicates.");
        return;
    }

    console.log(`Scanning ${snapshot.size} documents for duplicates...`);

    const seenQuestions = new Map();
    const duplicates = [];

    // Identify duplicates
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Create a unique signature based on topic, lang, and normalized question text
        const signature = `${data.lang}_${data.topic}_${data.question.replace(/\s+/g, '').toLowerCase()}`;

        if (seenQuestions.has(signature)) {
            duplicates.push(doc); // This is a duplicate
        } else {
            seenQuestions.set(signature, true);
        }
    });

    if (duplicates.length === 0) {
        console.log("✅ No duplicates found. Database is clean.");
        return;
    }

    console.log(`⚠️ Found ${duplicates.length} duplicates. Deleting...`);

    // Batch delete
    const batchSize = 400; 
    let batch = writeBatch(db);
    let count = 0;
    let totalDeleted = 0;

    for (const doc of duplicates) {
        batch.delete(doc.ref);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            totalDeleted += count;
            console.log(`🗑️ Deleted ${totalDeleted}...`);
            batch = writeBatch(db);
            count = 0;
            await new Promise(r => setTimeout(r, 500));
        }
    }

    if (count > 0) {
        await batch.commit();
        totalDeleted += count;
    }

    console.log(`✨ Cleanup Complete! Removed ${totalDeleted} duplicate questions.`);

  } catch (e) {
    console.error("❌ Error during deduplication:", e.message);
  }
}

deduplicateDatabase();