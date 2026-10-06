import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { RekognitionClient, DetectModerationLabelsCommand } from "https://esm.sh/@aws-sdk/client-rekognition@3.370.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // 2. Parse the request to get base64 frames
    const { frames } = await req.json() // Expects an array of base64 strings

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      throw new Error("Missing or invalid frames data. Expected an array of base64 strings.")
    }

    // 3. Initialize AWS Rekognition Client
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const region = Deno.env.get('AWS_REGION') ?? 'us-east-1'

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials are not configured properly.")
    }

    const client = new RekognitionClient({
      region,
      credentials: { accessKeyId, secretAccessKey }
    })

    // 4. Analyze each frame concurrently
    const moderationPromises = frames.map(async (base64Str) => {
      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "")
      
      // Convert base64 to Uint8Array for AWS SDK
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

      const command = new DetectModerationLabelsCommand({
        Image: { Bytes: imageBytes },
        MinConfidence: 60 // Threshold for confidence
      })

      return client.send(command)
    })

    const results = await Promise.all(moderationPromises)

    // 5. Evaluate results (looking for labels like Explicit Nudity, Violence, etc.)
    const violations: string[] = []
    
    for (const result of results) {
      if (result.ModerationLabels && result.ModerationLabels.length > 0) {
        result.ModerationLabels.forEach(label => {
          if (!violations.includes(label.Name!)) {
            violations.push(label.Name!)
          }
        })
      }
    }

    const isSafe = violations.length === 0

    return new Response(
      JSON.stringify({
        isSafe,
        violations, // Will be empty if isSafe is true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error("Error in moderate-video:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
