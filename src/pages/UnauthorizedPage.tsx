import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export function UnauthorizedPage() {
  const { session, role, loading, signOut } = useAuth()
  return <main className="page"><h1>Access restricted</h1>
    {loading ? <p>Checking your account…</p> : <>
      <p>Signed in as: {session?.user.email ?? 'Not signed in'} · Role: {role ?? 'None'}</p>
      <p>Teacher review requires a teacher or administrator account. Students cannot view other students’ code.</p>
      <p>The platform owner account is trantrongnguyenhg@gmail.com. If you signed in with a different email, sign out and use the owner account.</p>
      <Link className="button link-button" to="/">Return to my dashboard</Link>
      <button className="button secondary" onClick={() => { void signOut().then(() => { window.location.hash = '/login' }) }}>Sign out and switch account</button>
    </>}
  </main>
}
