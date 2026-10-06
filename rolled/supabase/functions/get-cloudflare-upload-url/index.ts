import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const authHeader = req.headers.get('Authorization')
    const token = authHeader ? authHeader.replace('Bearer ', '') : ''
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message || "No user found" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Setup Cloudflare Config
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN')

    if (!accountId || !apiToken) {
      throw new Error("Cloudflare credentials are not configured properly.")
    }

    // 3. Request Direct Upload URL from Cloudflare Stream
    const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: 90, 
        requireSignedURLs: false, 
        creator: user.id // Attach the user ID to the video metadata
      }),
    })

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text()
      throw new Error(`Cloudflare error: ${cfResponse.status} - ${errorText}`)
    }

    const cfData = await cfResponse.json()

    // cfData.result contains uploadURL and uid
    return new Response(
      JSON.stringify({
        uploadURL: cfData.result.uploadURL,
        uid: cfData.result.uid
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error("Error in get-cloudflare-upload-url:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
