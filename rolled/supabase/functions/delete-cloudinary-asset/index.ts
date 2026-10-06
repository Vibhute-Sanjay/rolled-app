import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { v2 as cloudinary } from "npm:cloudinary@1.41.3";

const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
});

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify Authentication (basic check, relying on Supabase Gateway)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header found' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const { urls } = await req.json();

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return new Response(JSON.stringify({ message: "No URLs provided" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        console.log(`Processing ${urls.length} images for deletion.`);

        const deletionPromises = urls.map(async (url: string) => {
            if (!url) return null;
            try {
                // Robust Public ID Extraction (Copied from delete-post-media)
                const splitUrl = url.split('/upload/');
                if (splitUrl.length < 2) {
                    console.warn(`Invalid Cloudinary URL format: ${url}`);
                    return null;
                }

                let pathParts = splitUrl[1].split('/');

                // Remove transformation segments and version segments
                while (pathParts.length > 0) {
                    const segment = pathParts[0];
                    const isTransformation = segment.includes(',');
                    const isVersion = /^v\d+$/.test(segment);

                    if (isTransformation || isVersion) {
                        pathParts.shift();
                    } else {
                        break;
                    }
                }

                if (pathParts.length === 0) {
                    console.warn(`Could not extract public_id from: ${url}`);
                    return null;
                }

                // Reassemble and remove extension
                let publicIdWithExt = pathParts.join('/');
                const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

                console.log(`Deleting public_id: ${publicId}`);

                return await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error(`Failed to delete image ${url}:`, err);
                return null;
            }
        });

        const results = await Promise.all(deletionPromises);

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
