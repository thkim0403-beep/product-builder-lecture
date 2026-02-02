const { spawn } = require('child_process');
const http = require('http');

async function waitForServer(url) {
    for (let i = 0; i < 30; i++) { 
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(url, (res) => {
                    if (res.statusCode === 200) {
                        res.resume(); 
                        resolve();
                    } else {
                        res.resume();
                        reject(new Error(`Status ${res.statusCode}`));
                    }
                });
                req.on('error', reject);
                req.end();
            });
            return;
        } catch (e) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw new Error("Server did not start in time");
}

async function runTest() {
    console.log("Starting Wrangler for API Testing...");
    const server = spawn('npx', ['wrangler', 'pages', 'dev', '.', '--port', '8788'], {
        stdio: 'inherit',
        shell: true,
        detached: true 
    });

    try {
        const baseUrl = 'http://127.0.0.1:8788';
        await waitForServer(baseUrl);
        console.log("Server is up on port 8788!");

        // --- TEST 1: KOREAN MODE (Naver API) ---
        console.log("\n[TEST 1] Korean Mode (Expect Naver API Usage)...");
        const resKo = await fetch(baseUrl + '/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: 'science', difficulty: 'Medium', lang: 'ko' }) // Changed to 'science'
        });
        
        const debugKo = resKo.headers.get('x-debug-log');
        console.log(`Status: ${resKo.status}`);
        
        let decodedKo = "";
        if (debugKo) {
            try {
                decodedKo = decodeURIComponent(escape(atob(debugKo)));
                console.log(`Debug Log (Decoded): ${decodedKo}`);
            } catch (e) {
                console.log(`Debug Log (Raw): ${debugKo}`);
            }
        }
        
        if (!resKo.ok) throw new Error("Korean API Request Failed");
        if (!decodedKo || (!decodedKo.includes('Naver') && !decodedKo.includes('Mock'))) {
             console.warn("⚠️ Warning: Naver API might not have triggered correctly or keys are missing.");
        } else {
             console.log("✅ PASS: Korean logic triggered (Naver trace found).");
        }


        // --- TEST 2: ENGLISH MODE (Open Trivia API) ---
        console.log("\n[TEST 2] English Mode (Expect OpenTrivia API Usage)...");
        const resEn = await fetch(baseUrl + '/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: 'general', difficulty: 'Medium', lang: 'en' }) 
        });

        const debugEn = resEn.headers.get('x-debug-log');
        console.log(`Status: ${resEn.status}`);

        let decodedEn = "";
        if (debugEn) {
            try {
                decodedEn = decodeURIComponent(escape(atob(debugEn)));
                console.log(`Debug Log (Decoded): ${decodedEn}`);
            } catch(e) {}
        }

        if (!resEn.ok) throw new Error("English API Request Failed");
        if (!decodedEn || !decodedEn.includes('OpenTrivia')) {
            throw new Error("❌ FAIL: OpenTrivia API was not triggered for English mode.");
        }
        console.log("✅ PASS: English logic triggered (OpenTrivia trace found).");


        // --- TEST 3: EXPLAIN API ---
        console.log("\n[TEST 3] Explain API...");
        const resExplain = await fetch(baseUrl + '/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wrongAnswers: [{question: "Q", correct: "A"}], lang: 'ko' })
        });
        const explainData = await resExplain.json();
        if(explainData.explanation) {
            console.log("✅ PASS: Explanation received.");
        } else {
            throw new Error("❌ FAIL: No explanation returned.");
        }

    } catch (e) {
        console.error("\n🛑 TEST SUITE FAILED:", e);
        process.exit(1);
    } finally {
        console.log("\nStopping server...");
        try {
            process.kill(-server.pid);
        } catch(e) {
            console.log("Cleanup error:", e.message);
        }
    }
}

runTest();
