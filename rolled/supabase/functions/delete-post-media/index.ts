import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { v2 as cloudinary } from "npm:cloudinary@1.41.3";

const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
});

serve(async (req) => {
    try {
        // 1. Verify Request
        // In a real production app, verify the Supabase service role key or webhook signature here.

        // 2. Parse Payload
        const payload = await req.json();
        console.log("Received Payload:", JSON.stringify(payload));

        // Supabase Database Webhooks payload structure for DELETE:
        // { type: 'DELETE', table: 'posts', schema: 'public', record: null, old_record: { ... } }
        const { old_record } = payload;

        if (!old_record) {
            return new Response("No old_record found", { status: 400 });
        }

        const mediaUrls = old_record.media_urls || [];
        
        // Also support profile deletions (avatar_url and bg_image_url)
        if (old_record.avatar_url) {
            mediaUrls.push(old_record.avatar_url);
        }
        if (old_record.bg_image_url) {
            mediaUrls.push(old_record.bg_image_url);
        }
        let cloudflareVideoId = old_record.cloudflare_video_id;

        // Fallback for legacy posts: if the column is null, try to extract the ID from the media_urls
        if (!cloudflareVideoId && mediaUrls.length > 0) {
            const cfUrl = mediaUrls.find((url: string) => url.includes('videodelivery.net'));
            if (cfUrl) {
                const match = cfUrl.match(/videodelivery\.net\/([^/]+)\/manifest/);
                if (match && match[1]) {
                    cloudflareVideoId = match[1];
                    console.log(`Legacy post detected: extracted Cloudflare ID ${cloudflareVideoId} from URL`);
                }
            }
        }

        if (mediaUrls.length === 0 && !cloudflareVideoId) {
            return new Response("No media to delete", { status: 200 });
        }

        console.log(`Processing deletion. Images: ${mediaUrls.length}, Cloudflare Video: ${cloudflareVideoId ? 'Yes' : 'No'}`);

        // 3. Extract Public IDs and Delete
        const deletionPromises: Promise<any>[] = [];

        if (mediaUrls.length > 0) {
            mediaUrls.forEach((url: string) => {
                const promise = (async () => {
            try {
                // Robust Public ID Extraction
                // Cloudinary Structure: .../upload/<transformations>/<version>/<public_id>.<ext>
                // We need to remove standard prefixes to get the clean public_id.

                const splitUrl = url.split('/upload/');
                if (splitUrl.length < 2) {
                    console.warn(`Invalid Cloudinary URL format: ${url}`);
                    return null;
                }

                let pathParts = splitUrl[1].split('/');

                // Remove transformation segments (contain commas, e.g., f_auto,q_auto) 
                // and version segments (start with v followed by digits, e.g., v176...)
                // We keep checking the first element until we find a real folder/file.
                while (pathParts.length > 0) {
                    const segment = pathParts[0];
                    const isTransformation = segment.includes(',');
                    const isVersion = /^v\d+$/.test(segment);

                    if (isTransformation || isVersion) {
                        pathParts.shift(); // Remove this segment
                    } else {
                        break; // Found the start of the public_id
                    }
                }

                if (pathParts.length === 0) {
                    console.warn(`Could not extract public_id from: ${url}`);
                    return null;
                }

                // Reassemble and remove extension
                let publicIdWithExt = pathParts.join('/');
                const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

                console.log(`Original URL: ${url}`);
                console.log(`Extracted public_id: ${publicId}`); // Should be accurate now

                return await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error(`Failed to delete image ${url}:`, err);
                return null;
            }
        })();
        deletionPromises.push(promise);
    });
}

// 4. Cloudflare Stream Deletion
if (cloudflareVideoId) {
    const cfPromise = (async () => {
        try {
            const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
            const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

            if (!cfAccount || !cfToken) {
                console.error("Missing Cloudflare credentials in Edge Function environment.");
                return { type: 'cloudflare', success: false, error: "Missing credentials" };
            }

            console.log(`Calling Cloudflare API to delete video: ${cloudflareVideoId}`);
            
            const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/stream/${cloudflareVideoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${cfToken}`
                }
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`Failed to delete Cloudflare video ${cloudflareVideoId}:`, errText);
                return { type: 'cloudflare', success: false, error: errText };
            }

            console.log(`Successfully deleted Cloudflare video ${cloudflareVideoId}`);
            return { type: 'cloudflare', success: true };
            
        } catch (err: any) {
            console.error(`Network error deleting Cloudflare video ${cloudflareVideoId}:`, err);
            return { type: 'cloudflare', success: false, error: err.message };
        }
    })();
    
    deletionPromises.push(cfPromise);
}

const results = await Promise.all(deletionPromises);

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
