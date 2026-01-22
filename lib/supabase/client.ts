/**
 * Supabase Client Singleton
 * 
 * Provides a singleton instance of the Supabase client to avoid
 * creating multiple connections.
 * 
 * Usage:
 *   import { getSupabaseClient } from '@/lib/supabase/client';
 *   const supabase = getSupabaseClient();
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client singleton.
 * Uses service role key for server-side operations.
 */
export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(
            'Missing Supabase environment variables. ' +
            'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        );
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return supabaseClient;
}

/**
 * Reset the client singleton (useful for testing)
 */
export function resetSupabaseClient(): void {
    supabaseClient = null;
}
