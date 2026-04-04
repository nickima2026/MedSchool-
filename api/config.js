// =============================================================================
// MSIB.io — Public Config API
// File: api/config.js
//
// Exposes NEXT_PUBLIC_ environment variables to static HTML pages.
// These are safe to expose — anon key is designed for client-side use.
// =============================================================================

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300', // cache 5 min at edge
  };

  return new Response(JSON.stringify({
    supabaseUrl:     process.env.NEXT_PUBLIC_SUPABASE_URL     ?? null,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
  }), { status: 200, headers: corsHeaders });
}
