
// Follow this setup guide to integrate the Deno runtime and the Supabase JS library with your Edge Functions.
// https://supabase.com/docs/guides/functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Hello from Push Notification Function! v3.0 [DEBUG]")

Deno.serve(async (req) => {
    // 1. Create Supabase Client
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Parse Payload
    const payload = await req.json()
    const record = payload.record

    if (!record || !record.user_id) {
        return new Response(JSON.stringify({ error: 'No record or user_id' }), { status: 400 })
    }

    console.log(`Processing notification for user: ${record.user_id}`)
    console.log(`Payload Actor ID: ${record.actor_id}`)

    // 3. Fetch Data in Parallel
    const [tokenResult, actorResult] = await Promise.all([
        supabase.from('profiles').select('push_token').eq('id', record.user_id).single(),
        record.actor_id
            ? supabase.from('profiles').select('username').eq('id', record.actor_id).single()
            : Promise.resolve({ data: null })
    ])

    // DEBUG LOGGING
    console.log("Actor Lookup Result:", JSON.stringify(actorResult))

    const pushToken = tokenResult.data?.push_token
    const actorName = actorResult.data?.username || 'Rolled'

    if (!pushToken) {
        console.log(`No push token found for user ${record.user_id}`)
        return new Response(JSON.stringify({ message: 'No push token found' }), { status: 200 })
    }

    // 4. Construct Payload
    let title = actorName
    let body = record.content

    if (record.type === 'system') {
        title = 'Rolled'
    }

    console.log(`Final Notification Title: ${title}`)

    // Determine Deep Link URL
    // Determine Deep Link URL (Fallback)
    let deepLink = ''
    if (record.type === 'follow' || record.type === 'follow_request') {
        deepLink = `/user/${record.actor_id}`
    } else if (record.type === 'message') {
        deepLink = `/messages/${record.resource_id}`
    } else if (record.type && record.type.includes('activity')) {
        deepLink = `/activity/${record.resource_id}`
    } else {
        deepLink = `/unrolled/${record.resource_id}` // Default to Post (Unrolled)
    }

    // 5. Send to Expo
    const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: {
            url: deepLink,
            type: record.type, // Pass specific type for client routing
            actor_id: record.actor_id,
            resource_id: record.resource_id
        },
        priority: 'high',
        channelId: 'default',
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    })

    const result = await res.json()
    console.log("Expo Result:", result)

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
})
