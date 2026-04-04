// =============================================================================
// MSIB.io — Signup API
// File: api/signup.js
//
// Edge Runtime serverless function — matches existing api/quiz.js pattern.
//
// Flow:
//   1. Receive { email, password, fullName, year }
//   2. Extract email domain → look up matching school in DB
//   3. Create Supabase auth user (auto-confirmed, domain-verified)
//   4. Stamp app_metadata with school_id + role so RLS works immediately
//   5. Insert profiles row
// =============================================================================

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // ── CORS headers ────────────────────────────────────────────────────────────
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: corsHeaders,
    });
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const { email, password, fullName, year } = body;

  if (!email || !password || !fullName || !year) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < 1 || yearNum > 6) {
    return new Response(JSON.stringify({ error: 'Year must be between 1 and 6.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  // ── Environment ──────────────────────────────────────────────────────────────
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500, headers: corsHeaders,
    });
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
  };

  // ── 1. Extract domain and look up school ─────────────────────────────────────
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Invalid email address.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const schoolRes = await fetch(
    `${supabaseUrl}/rest/v1/schools?email_domain=eq.${encodeURIComponent(domain)}&select=id,name,slug&limit=1`,
    { headers: authHeaders }
  );

  const schools = await schoolRes.json();

  if (!Array.isArray(schools) || schools.length === 0) {
    return new Response(JSON.stringify({
      error: `Your email domain (@${domain}) is not registered with any school. Please contact your administrator.`,
    }), { status: 400, headers: corsHeaders });
  }

  const school = schools[0];

  // ── 2. Create auth user (admin, auto-confirmed) ──────────────────────────────
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,           // domain-verified — skip email confirmation
      app_metadata: {
        school_id: school.id,        // RLS uses this
        role: 'student',
      },
      user_metadata: {
        full_name: fullName,
      },
    }),
  });

  const newUser = await createRes.json();

  if (!createRes.ok) {
    // Surface Supabase's error message (e.g. "User already registered")
    const msg = newUser?.msg || newUser?.message || newUser?.error_description || 'Failed to create account.';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: corsHeaders,
    });
  }

  // ── 3. Insert profiles row ───────────────────────────────────────────────────
  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...authHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id:        newUser.id,
      school_id: school.id,
      full_name: fullName,
      role:      'student',
      year:      yearNum,
    }),
  });

  if (!profileRes.ok) {
    // Non-fatal — user can still log in; profile can be created later
    console.error('MSIB signup: profile insert failed for user', newUser.id);
  }

  // ── 4. Return success ────────────────────────────────────────────────────────
  return new Response(JSON.stringify({
    success: true,
    school:  school.name,
    message: `Account created! Welcome to ${school.name}.`,
  }), { status: 200, headers: corsHeaders });
}
