# Firebase authentication, Supabase classroom data

Firebase project: `apu-studio`. Passwords, registration, verification and password-reset emails are managed by Firebase. Google sign-in remains removed. Analytics is not loaded.

## Session bridge

The `firebase-session` Supabase Edge Function independently validates a Firebase RS256 token against Google's public signing keys, the exact issuer and audience, verified email, and live Firebase account state/revocation time. It accepts no email or role from the request body. After verification it opens an internal Supabase data session for the verified email. This preserves existing Supabase UUIDs, foreign keys, RLS and protected `cs_profiles` roles; new users receive the existing student default.

This implementation uses a verified-token exchange, NOT direct Firebase tokens against Postgres. Therefore native third-party role custom claims are not required. Firebase is the user-facing password authentication service; Supabase Auth remains an internal data-session mechanism. No classroom records are migrated or deleted.

`verify_jwt=false` on the function is intentional: the function verifies Firebase tokens itself before using any privileged Supabase API. Supabase service credentials remain in the Edge Function environment. No Firebase service-account key is deployed to the function or browser.

Verified Firebase email ownership is mandatory before mapping an existing account. Existing unverified Firebase accounts are never automatically marked verified or given administrative rights. Firebase changes do not instantly revoke already-issued Supabase data access tokens; existing tokens remain valid until their Supabase expiration. Frontend logout clears both sessions. For stricter immediate revocation, replace the exchange with a request-verifying data proxy or fully migrate RLS to native Firebase identity.

## Admin provisioning

Set `APU_FIREBASE_ADMIN_FILE` to an external service-account JSON path and run:

```
node scripts/firebase-admin.mjs check
node scripts/firebase-admin.mjs provision-admin
```

The script only provisions the requested owner account, with its known legacy UUID and a random password that is never printed or stored. It does not overwrite existing Firebase users. Request a Firebase password reset to select a private password. The Supabase admin role is not modified by this script.

Do not commit service-account JSON, generated tokens, or passwords. The web Firebase config is public configuration, not a service-account secret.

## Deployment and recovery

- Enable Email/Password in Firebase Authentication.
- Firebase's default hosted email action handler can verify email and reset passwords without the local website running. Return to the website afterwards.
- If using a custom password action handler, the application supports `?mode=resetPassword&oobCode=...` at its base path; configure exact authorized domains and template URLs in Firebase.
- Former Supabase-only accounts need a Firebase account with the same email and verified ownership. Their Supabase password is not imported.
- Sign in again after verifying the email. Resend verification is available after entering correct Firebase credentials.
- Deploy the Edge Function with the frontend. Keep database RLS enabled.

References: https://firebase.google.com/docs/auth/web/password-auth and https://supabase.com/docs/reference/javascript/auth-admin-generatelink
