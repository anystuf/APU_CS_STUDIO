import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { firebaseAuth } from '../../lib/firebase/client'

export async function signIn(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
  if (!user.emailVerified) throw new Error('Please confirm your Firebase verification email first, then sign in again.')
}
export async function signUp(email: string, password: string, name: string) {
  const { user } = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
  try {
    await updateProfile(user, { displayName: name.trim() })
    await sendEmailVerification(user)
  } catch {
    throw new Error('Account created, but the verification email could not be sent. Sign in and use Resend verification email. Do not create the account again.')
  } finally { await signOut(firebaseAuth) }
}
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(firebaseAuth, email.trim())
}
export async function resendVerification() {
  const user = firebaseAuth.currentUser
  if (!user) throw new Error('Enter your email and password and sign in first, then resend verification.')
  await sendEmailVerification(user)
}
export function authErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email or password is incorrect. Existing Supabase users must first set up a Firebase password using Forgot password.'
  if (code === 'auth/email-already-in-use') return 'This email already has a Firebase account. Sign in or use Forgot password.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait before trying again.'
  if (code === 'auth/operation-not-allowed') return 'Email/password login is not enabled in Firebase Authentication.'
  if (code === 'auth/network-request-failed') return 'Unable to connect. Check your connection and try again.'
  return error instanceof Error ? error.message : 'Unable to sign in. Please try again.'
}
