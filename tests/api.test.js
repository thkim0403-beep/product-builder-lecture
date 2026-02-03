const { spawn } = require('child_process');
const http = require('http');

async function waitForServer(url) {
    for (let i = 0; i < 30; i++) { // Wait up to 30 seconds
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(url, (res) => {
                    if (res.statusCode === 200) {
                        res.resume(); // Consume response
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
    console.log("Starting Wrangler...");
    // Use setsid to run in new process group for clean killing
    const server = spawn('npx', ['wrangler', 'pages', 'dev', '.', '--port', '8787'], {
        stdio: 'inherit',
        shell: true,
        detached: true 
    });

    try {
        const baseUrl = 'http://127.0.0.1:8787';
        await waitForServer(baseUrl);
        console.log("Server is up!");

        // Test 1: Static File
        console.log("Test 1: Fetching index.html...");
        const res1 = await fetch(baseUrl + '/');
        if (res1.status !== 200) throw new Error("Failed to fetch index.html");
        console.log("PASS: index.html loaded");

        // Test 2: Generate Quiz API
        console.log("Test 2: Generating Quiz (Korean)...");
        const payload = { topic: 'general', difficulty: 'Easy', lang: 'ko' };
        const res2 = await fetch(baseUrl + '/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        console.log(`API Status: ${res2.status}`);
        if (!res2.ok) {
            const txt = await res2.text();
            throw new Error(`API Failed: ${txt}`);
        }

        const data = await res2.json();
        console.log("API Response Preview:", JSON.stringify(data).slice(0, 100) + "...");
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("API returned invalid data format");
        }
        if (!data[0].question || !data[0].correct) {
            throw new Error("Quiz item missing question/correct fields");
        }
        console.log("PASS: Quiz generated successfully");

        // Test 2.1: Verify History Mock Data (Improved Mock)
        console.log("Test 2.1: Checking History Mock Data...");
        const histPayload = { topic: 'history', difficulty: 'Easy', lang: 'ko' };
        const resHist = await fetch(baseUrl + '/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(histPayload)
        });
        const histData = await resHist.json();
        const foundLee = histData.some(q => q.answers.includes("이순신") || q.correct === "이순신");
        if (!foundLee) {
            console.warn("WARNING: History mock data didn't contain '이순신'. Might be using old mocks or fallback.");
        } else {
            console.log("PASS: History mock data looks correct (Found '이순신')");
        }

        // Test 3: Explain API (Mocking wrong answers)
        console.log("Test 3: Explain Wrong Answers...");
        const explainPayload = { 
            wrongAnswers: [{ question: "Test Q", correct: "Test A" }], 
            lang: 'ko' 
        };
        const res3 = await fetch(baseUrl + '/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(explainPayload)
        });

        if (!res3.ok) throw new Error(`Explain API Failed: ${res3.status}`);
        const explainData = await res3.json();
        
        console.log("Explanation Response:", JSON.stringify(explainData).slice(0, 100) + "...");
        
        if (!explainData.explanation) throw new Error("No explanation returned");
        console.log("PASS: Explanation received");

    } catch (e) {
        console.error("TEST FAILED:", e);
        process.exit(1);
    } finally {
        console.log("Stopping server...");
        try {
            process.kill(-server.pid);
        } catch(e) {
            console.log("Could not kill server (maybe already dead):", e.message);
        }
    }
}

runTest();
