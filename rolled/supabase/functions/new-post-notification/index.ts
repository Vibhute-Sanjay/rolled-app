import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("New Post Notification Function Started v1.0")

Deno.serve(async (req) => {
    // 1. Setup Supabase
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Parse Trigger Payload
    const payload = await req.json()
    const { record, old_record, type } = payload

    if (!record || !record.user_id) {
        return new Response(JSON.stringify({ error: 'No record or user_id' }), { status: 400 })
    }

    const posterId = record.user_id
    const postId = record.id
    
    // Ignore posts that are still processing
    if (record.status && record.status !== 'published') {
        console.log(`Skipping notification for post ${postId} because status is ${record.status}`)
        return new Response(JSON.stringify({ message: 'Post not published yet' }), { status: 200 })
    }

    // FIX: Prevent "every update triggers a notification" bug (e.g. when views_count updates)
    // If it's an UPDATE event, ONLY notify if the status just changed to 'published'
    if (type === 'UPDATE') {
        const oldStatus = old_record?.status;
        const newStatus = record.status;
        
        // If status didn't change, or it didn't change to 'published', skip it.
        if (oldStatus === newStatus || newStatus !== 'published') {
            console.log(`Skipping UPDATE notification: status didn't change to published.`)
            return new Response(JSON.stringify({ message: 'Not a status change to published' }), { status: 200 })
        }
    }


    console.log(`Processing new post ${postId} from user ${posterId}`)

    try {
        // 3. Get Poster's Username
        const { data: poster, error: posterError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', posterId)
            .single()

        if (posterError || !poster) {
            console.error("Failed to fetch poster profile:", posterError)
            return new Response(JSON.stringify({ error: 'Poster not found' }), { status: 404 })
        }

        const username = poster.username

        // 4. Get Followers' Push Tokens
        // Step A: Get all follower IDs
        const { data: follows, error: followsError } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', posterId)

        if (followsError) {
            console.error("Failed to fetch followers:", followsError)
            return new Response(JSON.stringify({ error: 'Failed to fetch followers' }), { status: 500 })
        }

        if (!follows || follows.length === 0) {
            console.log("No followers to notify.")
            return new Response(JSON.stringify({ message: 'No followers' }), { status: 200 })
        }

        const followerIds = follows.map(f => f.follower_id)

        // Step B: Get tokens for these IDs
        // Note: .in() has a limit (usually ~65k params in Postgres, but URL length might limit via REST). 
        // For < 1000 followers this is fine. For scale, this function needs pagination.
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('push_token')
            .in('id', followerIds)
            .not('push_token', 'is', null) // Only get users with tokens

        if (profilesError) {
            console.error("Failed to fetch profiles:", profilesError)
            return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), { status: 500 })
        }

        // Filter valid tokens
        const tokens = profiles
            .map((p: any) => p.push_token)
            .filter((t: string) => t && t.startsWith('ExponentPushToken'))

        // Remove duplicates
        const uniqueTokens = [...new Set(tokens)]

        console.log(`Found ${uniqueTokens.length} unique tokens to notify.`)

        if (uniqueTokens.length === 0) {
            return new Response(JSON.stringify({ message: 'No valid tokens' }), { status: 200 })
        }

        // 5. Send to Expo in Batches
        const messages = uniqueTokens.map(token => ({
            to: token,
            sound: 'default',
            title: 'New Post',
            body: `${username} rolled out a new post`,
            data: {
                url: `/unrolled/${postId}`, // Deep link to post
                type: 'new_post'
            },
            priority: 'high', // Required for Android heads-up display
            channelId: 'default', // Explicitly target the channel we created with max importance
        }))

        // Expo recommends batches of 100
        const batches = chunkArray(messages, 100)
        const results = []

        for (const batch of batches) {
            try {
                const res = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(batch),
                })
                const json = await res.json()
                results.push(json)
            } catch (e) {
                console.error("Expo Send Error:", e)
            }
        }

        return new Response(JSON.stringify({ success: true, results }), { headers: { 'Content-Type': 'application/json' } })

    } catch (err: any) {
        console.error("Unexpected error:", err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})

function chunkArray(array: any[], size: number) {
    const chunked = []
    let index = 0
    while (index < array.length) {
        chunked.push(array.slice(index, size + index))
        index += size
    }
    return chunked
}
