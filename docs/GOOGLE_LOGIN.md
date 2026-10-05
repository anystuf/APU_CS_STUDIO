# Google sign-in setup

Google sign-in is deferred and removed from the login and signup page. This checklist is retained for future implementation. The platform currently uses email/password only. No Google client secret belongs in Vite variables or frontend code.

## Hosted provider configuration

1. In https://console.cloud.google.com/auth/clients create an OAuth client of type **Web application**. Configure branding, audience and the basic openid, email and profile scopes. If the app is in Testing, add the intended users as test users.
2. Set the authorized JavaScript origin to `http://127.0.0.1:5173` (and the actual production origin when deployed).
3. Set the authorized redirect URI to `https://scgkjbrdeqjcsthlxpnz.supabase.co/auth/v1/callback`. This is the Supabase callback, NOT the Vite page.
4. Open https://supabase.com/dashboard/project/scgkjbrdeqjcsthlxpnz/auth/providers?provider=Google . Enable Google and save the OAuth client ID and secret there, never in the browser application.
5. In Supabase Authentication URL Configuration, allow `http://127.0.0.1:5173/` and `http://127.0.0.1:5173/?recovery=1`. Add exact production URLs when deployed. Set Site URL to the actual app URL.

## Verification

- Click **Continue with Google** and choose the existing confirmed Gmail `trantrongnguyenhg@gmail.com`.
- Complete Google's consent yourself. The application must return to the classroom and load the existing `cs_profiles` role. It does not grant admin permissions based on email or Google metadata.
- Supabase automatic identity linking normally links a verified Google identity to an existing account with the same verified email. Verify the existing user ID and admin role remain unchanged; do not create or promote a duplicate account.
- New users should have student access, not teacher/admin access.
- Disabled Google provider is reported inline without sending the user to a dead-end OAuth page.

Reference: https://supabase.com/docs/guides/auth/social-login/auth-google
