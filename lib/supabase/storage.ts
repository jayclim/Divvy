import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'receipts';

// Signed URLs expire after 1 hour (in seconds)
const SIGNED_URL_EXPIRY = 60 * 60;

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Uploads a receipt image to Supabase Storage (private bucket)
 * @param userId - The user's ID for organizing files
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - The image MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns The storage path (not a URL) - use getReceiptSignedUrl() for access
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

    // Return the file path (not a public URL)
    // Use getReceiptSignedUrl() to generate time-limited access URLs
    return data.path;
}

/**
 * Generates a time-limited signed URL for accessing a receipt image
 * @param storagePath - The storage path returned from uploadReceiptImage
 * @param expiresIn - Optional expiry time in seconds (default: 1 hour)
 * @returns A signed URL that expires after the specified time
 */
export async function getReceiptSignedUrl(
    storagePath: string,
    expiresIn: number = SIGNED_URL_EXPIRY
): Promise<string> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, expiresIn);

    if (error) {
        console.error('Supabase signed URL error:', error);
        throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
}

/**
 * Deletes a receipt image from Supabase Storage
 * @param storagePath - The storage path of the image to delete
 */
export async function deleteReceiptImage(storagePath: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

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