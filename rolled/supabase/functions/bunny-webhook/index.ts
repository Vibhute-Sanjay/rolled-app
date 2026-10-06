import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Bunny.net Webhook Function Started v1.0")

Deno.serve(async (req) => {
    try {
        // Bunny.net sometimes sends POST or GET, ensure we handle POST
        if (req.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 })
        }

        const payload = await req.json()
        const videoGuid = payload.VideoGuid
        const status = payload.Status

        console.log(`Received Webhook for Video: ${videoGuid} | Status: ${status}`)

        // Status 4 = Finished processing in Bunny.net Stream
        if (status !== 4 || !videoGuid) {
            return new Response(JSON.stringify({ message: 'Ignored status or missing guid' }), { status: 200 })
        }

        // 1. Setup Supabase
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Find the processing post containing this VideoGuid
        const { data: posts, error: fetchError } = await supabase
            .from('posts')
            .select('id, media_urls, user_id')
            .eq('status', 'processing')

        if (fetchError || !posts) {
            console.error("Fetch Error:", fetchError)
            return new Response(JSON.stringify({ error: 'Database fetch failed' }), { status: 500 })
        }

        const matchedPost = posts.find((p: any) => 
            p.media_urls.some((url: string) => url.includes(videoGuid))
        )

        if (!matchedPost) {
            console.log(`No processing post found for video ${videoGuid}`)
            return new Response(JSON.stringify({ message: 'Post not found or already published' }), { status: 200 })
        }

        console.log(`Found matching post ${matchedPost.id}. Updating status to 'published'...`)

        // 3. Update the post to trigger real-time listeners
        const { error: updateError } = await supabase
            .from('posts')
            .update({ status: 'published' })
            .eq('id', matchedPost.id)

        if (updateError) {
            console.error("Update Error:", updateError)
            return new Response(JSON.stringify({ error: 'Database update failed' }), { status: 500 })
        }

        // 4. Manually trigger the new-post-notification!
        // Because Supabase Triggers only fire on INSERT, an UPDATE won't trigger the new-post-notification automatically.
        // I must invoke it here manually.
        try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/new-post-notification`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    record: {
                        id: matchedPost.id,
                        user_id: matchedPost.user_id,
                        status: 'published'
                    }
                })
            })
            console.log("Triggered new-post-notification for followers.")
        } catch (pushErr) {
            console.error("Failed to trigger new-post-notification:", pushErr)
        }

        console.log(`Successfully published post ${matchedPost.id}`)
        return new Response(JSON.stringify({ success: true, postId: matchedPost.id }), { status: 200 })

    } catch (err: any) {
        console.error("Unexpected error:", err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
