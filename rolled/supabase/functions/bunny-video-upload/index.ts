import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const libraryId = Deno.env.get('BUNNY_LIBRARY_ID')
    const apiKey = Deno.env.get('BUNNY_API_KEY')
    const pullZone = Deno.env.get('BUNNY_PULL_ZONE') || `vz-${libraryId}.b-cdn.net`

    if (!libraryId || !apiKey) {
      throw new Error('Bunny credentials not configured')
    }

    const { title } = await req.json().catch(() => ({ title: 'Video Post' }));

    // Step 1: Create Video Object in Bunny.net
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: title || 'Video Post' }),
    })

    if (!createRes.ok) {
      throw new Error(`Failed to create video: ${await createRes.text()}`)
    }

    const createData = await createRes.json()
    const videoId = createData.guid

    // Step 2: Generate TUS Authorization Signature
    // Signature format: SHA256(library_id + api_key + expiration_time + video_id)
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const msgString = `${libraryId}${apiKey}${expirationTime}${videoId}`;
    
    // Hash it using Web Crypto API built into Deno
    const msgBuffer = new TextEncoder().encode(msgString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Step 3: Return credentials to client
    const hlsUrl = `https://${pullZone}/${videoId}/playlist.m3u8`

    return new Response(JSON.stringify({ 
      success: true, 
      videoId, 
      libraryId,
      signature,
      expirationTime,
      hlsUrl 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
