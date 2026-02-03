// functions/api/scheduled-quiz-gen.js
// This function mimics the admin tool but runs on a schedule or via direct API call with a secret key.

export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. Security Check (Prevent unauthorized access)
    // In production, you should set a CRON_SECRET in Cloudflare settings.
    const url = new URL(request.url);
    const secret = request.headers.get('X-Cron-Secret') || url.searchParams.get('secret');
    
    // Simple protection: If env.CRON_SECRET is set, verify it.
    if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const topics = ["history", "science", "general", "movies"];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        const lang = "ko"; // Default to Korean for daily refill

        // 2. Reuse the generate-quiz logic via internal fetch or logic duplication
        // Since we can't easily fetch our own worker's other endpoints internally in all envs,
        // we'll trigger the generation logic directly here or use a self-fetch if fully deployed.
        
        // For simplicity and reliability in this architecture, we will simulate an Admin client
        // by returning instructions to the caller (or actual execution if we move logic to a shared lib).
        
        // However, standard Workers/Pages Functions don't support 'scheduled' events in the same file as HTTP handlers easily without wrangler.toml config.
        // Instead, we will make this an endpoint that you can call via a reliable external Cron service (like GitHub Actions or cron-job.org)
        // OR we rely on Cloudflare's native Cron Triggers if configured in wrangler.toml.

        // Let's assume this is triggered by a Cron Job.
        
        // --- LOGIC START ---
        // We will call our own generate-quiz endpoint to produce data
        const baseUrl = new URL(request.url).origin;
        const genRes = await fetch(`${baseUrl}/api/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: randomTopic, difficulty: 'Medium', lang })
        });

        if (!genRes.ok) throw new Error("Generation API Failed");
        const questions = await genRes.json();

        // 3. Save to Firestore (We need Admin SDK or REST API here)
        // Since Pages Functions don't have full Node.js Firebase Admin SDK support easily,
        // we usually use the REST API. But we don't have auth tokens here easily without Service Account.
        
        // **CRITICAL LIMITATION**: 
        // Writing to Firestore from a pure server-side Worker WITHOUT user auth (like in admin.html) requires a Service Account Key.
        // Standard 'firebaseConfig' (Client SDK) doesn't work well in Workers/Node environment without a user being signed in.
        
        return new Response(JSON.stringify({ 
            status: "Generated", 
            count: questions.length, 
            topic: randomTopic,
            note: "To save to DB automatically from server-side, Firestore Admin SDK/Service Account is required." 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}