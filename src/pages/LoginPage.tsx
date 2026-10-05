import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Code2, LogIn, UserPlus } from 'lucide-react'
import { appConfig } from '../config/app'
import { useAuth } from '../features/auth/AuthProvider'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { signIn, signUp, resetPassword, resendVerification, authErrorMessage } from '../features/auth/firebaseAuth'

type AuthMode = 'signin' | 'signup' | 'reset'

export function LoginPage() {
  const { session, authError, loading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (mode === 'signup' && (!name.trim() || password !== confirmation)) {
      setMessage(!name.trim() ? 'Please enter your full name.' : 'Passwords do not match. Please check both password fields.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
    if (mode === 'reset') {
      await resetPassword(email)
      setMessage('If this email has a Firebase account, a password-reset email has been requested. Check your inbox and spam folder.')
    } else if (mode === 'signin') {
      await signIn(email, password)
    } else {
      await signUp(email, password, name)
      setPassword('')
      setConfirmation('')
      setMessage('Account created in Firebase. Confirm your verification email, then sign in here. Check your spam folder too.')
    }
    } catch (error) {
      setMessage(authErrorMessage(error))
    } finally { setBusy(false) }
  }

  const switchMode = (next: AuthMode) => { setMode(next); setMessage(''); setPassword(''); setConfirmation(''); setShowPassword(false) }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-logo"><Code2/></div>
    <p className="eyebrow">PYTHON CLASSROOM</p><h1>{mode === 'reset' ? 'Recover your account' : mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
    <p>{mode === 'reset' ? 'Enter your account email to request a link for setting a new password.' : mode === 'signin' ? `Sign in to ${appConfig.appName} with your Gmail and password.` : 'Students can create an account, open the Python IDE, and save work for their teacher.'}</p>
    {!isSupabaseConfigured && <p className="alert">Account service is not configured yet.</p>}
    <div className="auth-tabs" aria-label="Account options">
      <button type="button" disabled={busy} aria-pressed={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}><LogIn size={17}/> Sign in</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}><UserPlus size={17}/> Create account</button>
    </div>
    <form className="password-form" onSubmit={submit}>
      <fieldset disabled={busy} className="auth-fields">
      {mode === 'signup' && <label><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" placeholder="Student name"/></label>}
      <label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="name@gmail.com"/></label>
      {mode !== 'reset' && <label><span>Password</span><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}/></label>}
      {mode === 'signup' && <>
        <small>Use at least 8 characters and a password you don’t use elsewhere.</small>
        <label><span>Confirm password</span><input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Enter your password again" aria-invalid={Boolean(confirmation && confirmation !== password)} aria-describedby={confirmation && confirmation !== password ? 'password-mismatch' : undefined}/></label>
        {confirmation && confirmation !== password && <small id="password-mismatch" className="auth-error">Passwords do not match.</small>}
      </>}
      {mode !== 'reset' && <button type="button" className="auth-text-button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide passwords' : 'Show passwords'}</button>}
      <button className="button" disabled={busy || loading || !isSupabaseConfigured}>{busy || loading ? 'Please wait…' : mode === 'reset' ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </fieldset>
    </form>
    {mode === 'signin' && <button type="button" disabled={busy} className="auth-text-button" onClick={() => switchMode('reset')}>Forgot password?</button>}
    {mode === 'reset' && <button type="button" disabled={busy} className="auth-text-button" onClick={() => switchMode('signin')}>Back to sign in</button>}
    {message && <p className="status" role="status">{message}</p>}
    {authError && <p className="alert" role="alert">{authError}</p>}
    {mode === 'signin' && <button type="button" disabled={busy || loading} className="auth-text-button" onClick={() => {
      setBusy(true)
      void resendVerification().then(() => setMessage('Verification email requested. Check your inbox and spam folder.')).catch(error => setMessage(authErrorMessage(error))).finally(() => setBusy(false))
    }}>Resend verification email</button>}
  </section></main>
}
