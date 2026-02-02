const http = require('https');

const BASE_URL = 'https://product-builder-lecture-dwj.pages.dev';

async function runProdTest() {
    console.log(`Starting Production Verification for: ${BASE_URL}`);
    console.log("Note: If you just pushed, the deployment might still be in progress (takes 1-2 mins).\n");

    try {
        // --- TEST 1: INDEX ACCESSIBILITY ---
        console.log("[TEST 1] Checking Index Page...");
        const resIndex = await fetch(BASE_URL);
        console.log(`Status: ${resIndex.status}`);
        if (!resIndex.ok) throw new Error("Could not access site root.");
        console.log("✅ PASS: Site is reachable.");

                // --- TEST 2: KOREAN MODE (Naver API) ---
                // Note: This relies on secrets being set in the Cloudflare Dashboard.
                console.log("\n[TEST 2] Korean Mode (Naver API) - Topic: Science...");
                const resKo = await fetch(`${BASE_URL}/api/generate-quiz`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic: 'science', difficulty: 'Medium', lang: 'ko' }) 
                });
                
                console.log(`Status: ${resKo.status}`);
                const koText = await resKo.text();
                
                let koDebug = resKo.headers.get('x-debug-log');
                if (koDebug) {
                     try {
                        // Simulate Client Decoding: decodeURIComponent(escape(atob(b64)))
                        const decoded = decodeURIComponent(escape(atob(koDebug)));
                        console.log(`Debug Log (Decoded): ${decoded}`);
                     } catch(e) {
                        console.log(`Debug Log (Raw/Error): ${koDebug} | ${e.message}`);
                     }
                }
        
                if (!resKo.ok) {
                    console.error("Response:", koText.slice(0, 200));
                    throw new Error("Korean API Failed");
                }
                
                try {
                    const jsonKo = JSON.parse(koText);
                    if(Array.isArray(jsonKo) && jsonKo.length > 0) {
                         console.log(`✅ PASS: Received ${jsonKo.length} Quiz Items.`);
                         console.log(`Sample Question: ${jsonKo[0].question}`);
                         console.log(`Sample Answers: ${jsonKo[0].answers.join(', ')}`);
                    } else {
                         console.warn("⚠️ Warning: Data format unexpected:", koText.slice(0, 100));
                    }
                } catch(e) {
                    console.error("Failed to parse JSON:", e.message);
                }

        // --- TEST 3: ENGLISH MODE (Open Trivia API) ---
        console.log("\n[TEST 3] English Mode (OpenTrivia API)...");
        const resEn = await fetch(`${BASE_URL}/api/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: 'general', difficulty: 'Medium', lang: 'en' })
        });
        
        console.log(`Status: ${resEn.status}`);
        if (!resEn.ok) {
            console.error("Response:", await resEn.text());
            throw new Error("English API Failed");
        }
        console.log("✅ PASS: English API responded.");


        // --- TEST 4: EXPLAIN API ---
        console.log("\n[TEST 4] Explain API...");
        const resExplain = await fetch(`${BASE_URL}/api/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wrongAnswers: [{question: "Q", correct: "A"}], lang: 'ko' })
        });
        
        if (resExplain.ok) {
            console.log("✅ PASS: Explain API responded.");
        } else {
            console.error("❌ FAIL: Explain API error", resExplain.status);
        }

    } catch (e) {
        console.error("\n🛑 PROD TEST FAILED:", e.message);
        process.exit(1);
    }
}

runProdTest();
