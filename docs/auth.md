# Customer sign-in

The header's "Daxil ol / Sign in / Войти" button opens `/<lang>/login`. Customers sign in with an e-mailed link
(Supabase Auth, no password) and see their orders on `/<lang>/account` (every order whose `buyer_email` is their
address, with a link to the order page and its downloads).

How it works: `app/api/auth/login` asks Supabase Auth (`POST /auth/v1/otp`, server-side with the service role key) to
e-mail a link. The link signs the customer in and the session is kept in httpOnly cookies (`havs_at`, `havs_rt`;
`havs_auth` only tells the header button to say "My account"). `lib/auth.ts` holds the REST calls and cookie rules.
Requests for a link are limited per visitor address and per e-mail address (table `auth_attempts`,
`lib/store.ts`).

## Supabase settings the owner must set (Dashboard → Authentication)

1. **URL configuration**
   - Site URL: `https://havs.dev`
   - Redirect URLs: `https://havs.dev/**`
2. **SMTP** (Authentication → Emails → SMTP settings). Until a custom SMTP server is set up, Supabase only sends to
   the project team's own addresses (about two e-mails an hour), and everyone else sees "E-mail sign-in is still being
   set up". Any provider works, for example Resend, Brevo or Amazon SES, with a sender such as `no-reply@havs.dev`
   and the provider's DNS records on havs.dev.
3. **E-mail templates** (recommended). With the default templates the link opens `/<lang>/auth/callback` and the page
   finishes the sign-in. Some mail scanners (Outlook Safe Links, corporate gateways) open links in advance and use up
   the one-time token. To avoid that, point the **Magic Link** and **Confirm signup** templates at the confirm page,
   which signs in only when the customer presses its button:

   ```html
   <h2>havs.dev</h2>
   {{ if eq .Data.locale "ru" }}
   <p><a href="{{ .SiteURL }}/ru/auth/confirm?token_hash={{ .TokenHash }}&type=email">Войти в havs.dev</a></p>
   {{ else if eq .Data.locale "en" }}
   <p><a href="{{ .SiteURL }}/en/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to havs.dev</a></p>
   {{ else }}
   <p><a href="{{ .SiteURL }}/az/auth/confirm?token_hash={{ .TokenHash }}&type=email">havs.dev-ə daxil ol</a></p>
   {{ end }}
   ```

   `.Data.locale` is the site language the customer had when they first asked for a link.
