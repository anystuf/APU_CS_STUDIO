import { readFileSync } from 'node:fs'
import { randomUUID, randomBytes } from 'node:crypto'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const path = process.env.APU_FIREBASE_ADMIN_FILE
if (!path) throw new Error('Set APU_FIREBASE_ADMIN_FILE to an external service-account JSON file.')
const credentials = JSON.parse(readFileSync(path, 'utf8'))
if (credentials.project_id !== 'apu-studio') throw new Error('Wrong Firebase project.')
initializeApp({ credential: cert(credentials) })
const auth = getAuth()
const command = process.argv[2]
if (command === 'check') {
  const users = await auth.listUsers(1)
  console.log(JSON.stringify({ connected: true, project: credentials.project_id, hasUsers: users.users.length > 0 }))
} else if (command === 'provision-admin') {
  const email = 'trantrongnguyenhg@gmail.com'
  try {
    const user = await auth.getUserByEmail(email)
    // Never overwrite credentials or mark an existing unverified Firebase account verified.
    console.log(JSON.stringify({ existing: true, email: user.email, verified: user.emailVerified, uid: user.uid }))
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    const user = await auth.createUser({ uid: 'd5d350c3-2c47-4789-89d0-917c05775ef3', email, emailVerified: true, password: randomBytes(32).toString('base64url'), displayName: 'Bao' })
    console.log(JSON.stringify({ created: true, email: user.email, uid: user.uid, next: 'Request a Firebase password reset. No password is printed or stored.' }))
  }
} else if (command === 'test-bridge') {
  const uid = randomUUID()
  const email = `apu-firebase-test-${uid}@example.com`
  await auth.createUser({ uid, email, emailVerified: true })
  try {
    const customToken = await auth.createCustomToken(uid)
    const exchange = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyByk-tH2N0heDCjG-UMgHj9iygZmPenVOA', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) })
    const firebase = await exchange.json()
    if (!exchange.ok) throw new Error('Firebase test token exchange failed')
    const response = await fetch('https://scgkjbrdeqjcsthlxpnz.supabase.co/functions/v1/firebase-session', { method: 'POST', headers: { Authorization: `Bearer ${firebase.idToken}` } })
    const session = await response.json()
    if (!response.ok) throw new Error(`Bridge failed: ${session.error}`)
    const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')] }))
    const result = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/cs_profiles?select=id,role,email`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` } })
    console.log(JSON.stringify({ status: response.status, profileStatus: result.status, profiles: await result.json(), testEmail: email }))
  } finally { await auth.deleteUser(uid) }
} else throw new Error('Use check, provision-admin, or test-bridge.')
