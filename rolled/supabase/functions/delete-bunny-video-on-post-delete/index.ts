import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Delete Media Function Started")

serve(async (req) => {
    try {
        const payload = await req.json()
        
        // Ensure this is a DELETE event from Supabase Webhooks
        if (payload.type !== 'DELETE' || !payload.old_record) {
            return new Response(JSON.stringify({ message: "Not a DELETE event" }), { status: 200 })
        }

        const oldPost = payload.old_record
        const mediaUrls: string[] = oldPost.media_urls || []

        if (mediaUrls.length === 0) {
            return new Response(JSON.stringify({ message: "No media to delete" }), { status: 200 })
        }

        const libraryId = Deno.env.get('BUNNY_LIBRARY_ID')
        const apiKey = Deno.env.get('BUNNY_API_KEY')

        if (!libraryId || !apiKey) {
            console.error("Missing Bunny.net credentials")
            return new Response(JSON.stringify({ error: "Missing Bunny config" }), { status: 500 })
        }

        let deletedCount = 0;

        for (const url of mediaUrls) {
            // Check if it's a Bunny.net video
            if (url.includes('b-cdn.net') || url.includes('bunnycdn.com')) {
                // Extract the Video GUID
                // Format: https://vz-[library-id].b-cdn.net/[VIDEO-GUID]/playlist.m3u8
                const match = url.match(/\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//i);
                
                if (match && match[1]) {
                    const videoId = match[1]
                    console.log(`Deleting Bunny.net video: ${videoId}`)

                    const deleteRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
                        method: 'DELETE',
                        headers: {
                            'AccessKey': apiKey
                        }
                    })

                    if (deleteRes.ok) {
                        console.log(`Successfully deleted video ${videoId}`)
                        deletedCount++;
                    } else {
                        console.error(`Failed to delete video ${videoId}: ${await deleteRes.text()}`)
                    }
                }
            }
            // Optional: Cloudinary image deletion logic can be added here
        }

        return new Response(JSON.stringify({ success: true, deletedCount }), { status: 200 })

    } catch (err: any) {
        console.error("Error in delete-media function:", err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
