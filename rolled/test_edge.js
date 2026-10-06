const SUPABASE_URL = "https://hbkslwngbsvwiudaxltb.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3Nsd25nYnN2d2l1ZGF4bHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjg1MzUsImV4cCI6MjA4MjcwNDUzNX0.7ZfT_oTDbdVGqK3dXGE_T3F6qvkEqdInrFzrgK7XLV0";

// A tiny valid 1x1 base64 pixel to test the Rekognition logic
const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function run() {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ frames: [dummyBase64] })
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error(e);
    }
}

run();
