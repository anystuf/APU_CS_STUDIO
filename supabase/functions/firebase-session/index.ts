import { createClient } from 'npm:@supabase/supabase-js@2.56.0'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.0'

const project = 'apu-studio'
const firebaseKey = 'AIzaSyByk-tH2N0heDCjG-UMgHj9iygZmPenVOA'
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer /i, '')
    if (!token) return reply(401, { error: 'Firebase authentication required' })
    const { payload } = await jwtVerify(token, jwks, { issuer: `https://securetoken.google.com/${project}`, audience: project, algorithms: ['RS256'] })
    if (!payload.sub || payload.email_verified !== true || typeof payload.email !== 'string') return reply(403, { error: 'Confirm your Firebase email before accessing classroom data.' })
    // Check current account state, including revocation, instead of trusting only a cached token.
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) })
    const account = (await lookup.json()).users?.[0]
    if (!lookup.ok || !account || account.localId !== payload.sub || !account.emailVerified || account.disabled || account.email?.toLowerCase() !== payload.email.toLowerCase() || Number(payload.auth_time) < Number(account.validSince ?? 0)) return reply(401, { error: 'Firebase session expired or revoked. Sign in again.' })
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    // Email is taken exclusively from the verified Firebase token, never from request body.
    // Existing Supabase users retain their UUID and protected cs_profiles role.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: payload.email, options: { data: { full_name: account.displayName ?? '' } } })
    if (linkError) return reply(503, { error: 'Could not open your classroom account. Please try again.' })
    const verifier = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await verifier.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
    if (error || !data.session) return reply(503, { error: 'Could not create a classroom session. Please try again.' })
    return reply(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token })
  } catch {
    return reply(401, { error: 'Invalid Firebase session. Sign in again.' })
  }
})
