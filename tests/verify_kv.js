const BASE_URL = 'https://product-builder-lecture-dwj.pages.dev';

async function verifyKV() {
    console.log(`🔎 Verifying KV Cache on ${BASE_URL}...`);
    
    // Topic likely to be cached or easy to generate
    const payload = { topic: 'science', difficulty: 'Medium', lang: 'ko' };

    try {
        console.log("1️⃣ First Request (Expect: GENERATE or KV_CACHE)...");
        const res1 = await fetch(`${BASE_URL}/api/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const src1 = res1.headers.get('X-Quiz-Source');
        console.log(`   👉 Source: ${src1}`);
        
        if (src1 === 'KV_CACHE') {
            console.log("   ✅ Cache Hit! (Already cached)");
        } else {
            console.log("   ℹ️ Cache Miss (Generated fresh). Waiting for propagation...");
            // Wait for KV write propagation (Eventual Consistency)
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log("2️⃣ Second Request (Expect: KV_CACHE)...");
        const res2 = await fetch(`${BASE_URL}/api/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const src2 = res2.headers.get('X-Quiz-Source');
        console.log(`   👉 Source: ${src2}`);

        if (src2 === 'KV_CACHE') {
            console.log("🎉 SUCCESS! KV Caching is working perfectly.");
        } else {
            console.log("⚠️ WARNING: Still getting generated content. Check KV binding or propagation delay.");
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

verifyKV();