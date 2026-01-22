import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'receipts';

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Uploads a receipt image to Supabase Storage
 * @param userId - The user's ID for organizing files
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - The image MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns The public URL of the uploaded image
 */
export async function uploadReceiptImage(
    userId: string,
    imageBase64: string,
    mimeType: string = 'image/jpeg'
): Promise<string> {
    const supabase = getSupabaseClient();

    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `${userId}/${timestamp}.${extension}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(imageBase64, 'base64');

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload receipt image: ${error.message}`);
    }

    // Construct the public URL manually to ensure correct format
    // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${data.path}`;

    console.log('[Supabase Storage] Generated public URL:', publicUrl);

    return publicUrl;
}

/**
 * Deletes a receipt image from Supabase Storage
 * Used for GDPR deletion requests or cleanup
 * @param imageUrl - The public URL of the image to delete
 */
export async function deleteReceiptImage(imageUrl: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Extract the file path from the URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`);

    if (pathParts.length !== 2) {
        throw new Error('Invalid receipt image URL');
    }

    const filePath = pathParts[1];

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

    if (error) {
        console.error('Supabase delete error:', error);
        throw new Error(`Failed to delete receipt image: ${error.message}`);
    }
}

/**
 * Deletes all receipt images for a user
 * Used for account deletion (GDPR compliance)
 * @param userId - The user's ID
 */
export async function deleteAllUserReceipts(userId: string): Promise<void> {
    const supabase = getSupabaseClient();

    // List all files in the user's folder
    const { data: files, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);

    if (listError) {
        console.error('Supabase list error:', listError);
        throw new Error(`Failed to list user receipts: ${listError.message}`);
    }

    if (!files || files.length === 0) {
        return; // No files to delete
    }

    // Delete all files
    const filePaths = files.map((file) => `${userId}/${file.name}`);

    const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

    if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw new Error(`Failed to delete user receipts: ${deleteError.message}`);
    }
}