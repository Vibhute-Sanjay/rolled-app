import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Cloudflare Webhook Receiver Started v1.0")

Deno.serve(async (req) => {
    // 1. Setup Supabase (Service Role needed to bypass RLS for background updates)
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        // 2. Parse Cloudflare Webhook Payload
        // Cloudflare sends application/json
        const payload = await req.json()
        console.log("Received Cloudflare Webhook:", JSON.stringify(payload))

        // Ensure it's a valid payload
        if (!payload || !payload.uid) {
            return new Response(JSON.stringify({ error: 'Invalid payload, missing uid' }), { status: 400 })
        }

        const uid = payload.uid

        // 3. Check if video is ready
        // Cloudflare payload includes readyToStream boolean or status.state === 'ready'
        if (payload.readyToStream || (payload.status && payload.status.state === 'ready')) {
            console.log(`Video ${uid} is ready. Waiting 4 seconds for Cloudflare CDN propagation...`)

            // Add CDN Buffer to avoid React Native 404 Race Condition on instant HLS playback
            await new Promise(resolve => setTimeout(resolve, 4000))

            // 4. Update the Post in Supabase
            // We find the post by cloudflare_uid and update its status
            const { data, error } = await supabase
                .from('posts')
                .update({ status: 'published' })
                .eq('cloudflare_video_id', uid)
                .select()
                .single()

            if (error) {
                console.error("Failed to update post status:", error)
                return new Response(JSON.stringify({ error: 'Database update failed' }), { status: 500 })
            }

            console.log("Successfully updated post:", data.id)
            return new Response(JSON.stringify({ success: true, message: 'Post published' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        } else {
            console.log(`Video ${uid} is not ready yet (state: ${payload.status?.state}). Ignoring.`)
            return new Response(JSON.stringify({ message: 'Ignored, not ready' }), { status: 200 })
        }

    } catch (err: any) {
        console.error("Unexpected error in webhook:", err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
