import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export function UnauthorizedPage() {
  const { session, role, loading, signOut } = useAuth()
  return <main className="page"><h1>You don't have access to this page</h1>
    {loading ? <p>Checking your access…</p> : <>
      <p>Signed in as: {session?.user.email ?? 'Not signed in'} · Role: {role ?? 'None'}</p>
      <p>{role === 'teacher' || role === 'admin' ? 'This link opens a student-only page. To review or publish an activity, open it from Course Management instead.' : role === 'student' ? 'This page is available to teachers and school administrators. You can still access your courses from your dashboard.' : 'Your account does not currently have access to this page. Please return to your dashboard or switch accounts.'}</p>
      <Link className="button link-button" to={role === 'teacher' || role === 'admin' ? '/teacher/courses' : '/'}>{role === 'teacher' || role === 'admin' ? 'Go to Course Management' : 'Back to Dashboard'}</Link>
      <button className="button secondary" onClick={() => { void signOut().then(() => { window.location.hash = '/login' }) }}>Use Another Account</button>
    </>}
  </main>
}
