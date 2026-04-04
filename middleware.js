// =============================================================================
// MSIB.io — Vercel Edge Middleware
// File: middleware.js  (place at project root, next to vercel.json)
//
// Purpose:
//   1. Reads the incoming hostname (e.g. stanford.msib.io)
//   2. Extracts the school slug (e.g. "stanford")
//   3. Looks up the school's UUID from Supabase
//   4. Stamps school_id into a cookie so the front-end Supabase client
//      can read it and pass it as a custom JWT claim at login time.
//
// How JWT stamping works:
//   - On sign-up / sign-in the front-end calls supabase.auth.signInWithOtp()
//   - A Supabase Auth Hook (see supabase/functions/custom-claims/index.ts)
//     reads the cookie / app_metadata and embeds school_id in the JWT.
//   - Every subsequent Supabase query automatically scopes data via RLS.
//
// Runtime: Vercel Edge (runs globally, < 1 ms overhead)
// =============================================================================

export const config = {
  runtime: 'edge',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MSIB_ROOT_DOMAIN  = 'msib.io';
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SCHOOL_COOKIE     = 'msib-school-id';
const SLUG_COOKIE       = 'msib-school-slug';

// Simple in-edge cache: slug → { id, name } for the lifetime of the worker
const schoolCache = new Map();

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------
export default async function middleware(req) {
  const url  = new URL(req.url);
  const host = req.headers.get('host') || '';

  // ── 1. Determine subdomain ──────────────────────────────────────────────
  const slug = extractSlug(host);

  // Not a school subdomain (e.g. msib.io itself, www.msib.io, localhost dev)
  if (!slug) {
    return nextWithSchool(req, null, null);
  }

  // ── 2. Resolve slug → school_id ─────────────────────────────────────────
  let school = schoolCache.get(slug);
  if (!school) {
    school = await fetchSchoolBySlug(slug);
    if (school) schoolCache.set(slug, school);
  }

  if (!school) {
    // Unknown subdomain → redirect to main site
    return Response.redirect(`https://${MSIB_ROOT_DOMAIN}`, 302);
  }

  // ── 3. Continue request; set cookies so client-side JS can read them ────
  return nextWithSchool(req, school.id, slug);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the school slug from the host header.
 * "stanford.msib.io"  → "stanford"
 * "msib.io"           → null
 * "localhost:3000"    → null (dev; handled separately below)
 */
function extractSlug(host) {
  // Strip port if present
  const bare = host.split(':')[0];

  // Local dev override: set MSIB_SCHOOL_SLUG env var to simulate a school
  if (!bare.endsWith(MSIB_ROOT_DOMAIN)) {
    const devSlug = process.env.MSIB_SCHOOL_SLUG;
    return devSlug || null;
  }

  const parts = bare.split('.');
  // parts = ["stanford", "msib", "io"]  → length 3, first part is slug
  if (parts.length < 3) return null;            // "msib.io" has only 2 parts
  const sub = parts[0];
  if (sub === 'www' || sub === 'app') return null;
  return sub;
}

/**
 * Look up a school row in Supabase using the REST API directly.
 * (No Node.js SDK needed — works in Edge runtime.)
 */
async function fetchSchoolBySlug(slug) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[MSIB middleware] Missing Supabase env vars');
    return null;
  }

  const endpoint =
    `${SUPABASE_URL}/rest/v1/schools` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&active=eq.true` +
    `&select=id,name,slug,primary_color,secondary_color,logo_url,welcome_message` +
    `&limit=1`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
      // Cache for 60 s at the Vercel edge layer (CDN)
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error('[MSIB middleware] Supabase fetch failed', res.status);
      return null;
    }

    const rows = await res.json();
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('[MSIB middleware] fetch error', err);
    return null;
  }
}

/**
 * Clone the response and stamp school cookies so front-end JS can
 * pass school_id to Supabase Auth custom claims hook.
 */
function nextWithSchool(req, schoolId, slug) {
  // Vercel Edge middleware: just pass through with modified response headers
  const res = new Response(null, { status: 200 });

  if (schoolId) {
    // HttpOnly: false — front-end JS must read these to build auth metadata
    const cookieOpts = `; Path=/; SameSite=Lax; Secure; Max-Age=86400`;
    res.headers.append('Set-Cookie', `${SCHOOL_COOKIE}=${schoolId}${cookieOpts}`);
    res.headers.append('Set-Cookie', `${SLUG_COOKIE}=${slug}${cookieOpts}`);
  }

  // Forward the original request (Vercel will serve the actual page)
  return res;
}