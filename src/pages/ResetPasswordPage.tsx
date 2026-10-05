import { useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { confirmPasswordReset } from 'firebase/auth'
import { firebaseAuth } from '../lib/firebase/client'

export function ResetPasswordPage() {
  const { signOut, finishRecovery } = useAuth()
  const code = new URLSearchParams(window.location.search).get('oobCode')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmation) { setMessage('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (!code) { setMessage('Missing recovery code. Request a new reset email.'); return }
      await confirmPasswordReset(firebaseAuth, code, password)
      setComplete(true)
      setPassword('')
      setConfirmation('')
      await signOut()
    } catch { setMessage('This recovery link is invalid or expired. Request a new Firebase reset email.') } finally { setBusy(false) }
  }
  const back = async () => { await signOut(); finishRecovery(); window.location.replace(window.location.origin + window.location.pathname + '#/login') }
  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1>
    {complete ? <p role="status">Password updated. Sign in with your new password. Your classroom data and account permissions are unchanged.</p>
      : !code ? <p role="status">This recovery link is missing or expired. Return to sign in and request a new link using Forgot password.</p>
      : <form className="password-form" onSubmit={submit}>
        <label><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)}/></label>
        <label><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)}/></label>
        <button className="button" disabled={busy}>{busy ? 'Updating…' : 'Save new password'}</button>
        {message && <p className="status" role="status">{message}</p>}
      </form>}
    <button className="button secondary" disabled={busy} onClick={() => { void back() }}>Return to sign in</button>
  </section></main>
}
