# Hiding Clerk from users (production instance + custom Google OAuth)

The only place users can still see the word **Clerk** is outside our code:

- **Google's account chooser** says “to continue to Clerk”, because the development
  Clerk instance signs in with Clerk's shared Google OAuth client.
- **Clerk's emails** (verification and password-reset codes) are sent from Clerk's
  development infrastructure.

Neither can be changed with CSS or app code. Both disappear once the app runs on a
Clerk **production** instance with **your own Google OAuth client** and **your own
email sender**.

Everything inside Murmur is already Clerk-free: the sign-in, sign-up, reset and
settings screens are custom components, the OAuth callback is `/sso-callback`, and
sign-out stays in the app.

---

## Prerequisites

1. A **registered domain** with editable DNS. A `*.vercel.app` address cannot be
   used: Clerk issues its Frontend API on a subdomain you control, such as
   `clerk.example.com`.
2. The Clerk application **claimed** by a real account. The current instance
   (`subtle-ewe-3124.clerk.accounts.dev`) is an accountless development instance.
3. A Google Cloud account.

The app itself may stay on `murmur-clone-3mb9.vercel.app`; only the Clerk Frontend
API needs the custom domain. The privacy and terms pages can also live on that
domain if you move the site to it.

---

## 1. Create the Clerk production instance

1. Open <https://dashboard.clerk.com> and claim the application.
2. Use the instance switcher at the top → **Create production instance**.
   Cloning the development settings is fine, but **SSO connections, Integrations
   and Paths do not copy** — they are configured again below.
3. Open **Domains** and add `clerk.<your-domain>` (for example
   `clerk.murmur.in`).
4. Clerk shows the DNS records. Add them at your registrar:
   - one CNAME for `clerk` (Frontend API),
   - one CNAME for `accounts` (Account Portal),
   - the email records Clerk lists if you want Clerk to send from your domain.
   Keep the records **DNS only** (no Cloudflare proxy).
5. Wait for the records to verify, then press **Deploy certificates**.

> DNS can take up to 48 hours, although it is usually minutes.

## 2. Create your own Google OAuth client

1. Open <https://console.cloud.google.com> and create a project named **Murmur**.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name: **Murmur** (this is the name Google shows on the chooser).
   - Support email, developer contact.
   - Authorized domains: `<your-domain>` (and the app domain if it differs).
   - App privacy policy: `https://<your-domain>/privacy`
   - Terms of service: `https://<your-domain>/terms`
3. Publish the app (**Publishing status → In production**). The `openid`, `email`
   and `profile` scopes are non-sensitive, so verification is usually not required,
   but Google may still review the app name and logo.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins:
     - `https://murmur-clone-3mb9.vercel.app` (or your app domain)
     - `http://localhost:3000`
   - Authorized redirect URI: the exact value Clerk shows on the Google connection
     page, normally `https://clerk.<your-domain>/v1/oauth_callback`.
5. Copy the **Client ID** and **Client secret**.

## 3. Connect Google in Clerk

1. Clerk Dashboard → **SSO connections** → **Add connection** → **For all users**
   → **Google**.
2. Enable **for sign-up and sign-in**.
3. Enable **Use custom credentials**, paste the Client ID and Client secret, and
   save.
4. Optionally upload the app logo in Clerk so the Account Portal matches Murmur.

## 4. Switch the keys

| Where | Variable | Value |
|---|---|---|
| Vercel (Production) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` |
| Render | `CLERK_SECRET_KEY` | `sk_live_…` |
| Render | `CLERK_JWT_KEY` | leave empty |
| Render | `CLIENT_URL` | the app origin, e.g. `https://murmur-clone-3mb9.vercel.app` |
| Local `.env.local` (optional) | publishable key | `pk_live_…` only if localhost was added to Clerk's allowed origins |

`NEXT_PUBLIC_*` values are inlined at build time, so **redeploy Vercel** after
changing them. Restart the Render service afterwards.

The backend derives Clerk's `authorizedParties` from `CLIENT_URL`; no code change is
needed as long as the app origin stays the same.

## 5. Email branding (removes the other Clerk trace)

### What the current email shows

Development instances send from `noreply@accounts.dev`, prefix the subject with
`[Development]`, and use the Clerk **application name** as the sender name. The
application is still unclaimed, so that name is the default **“My Application”**.

### Rename the application now (no domain needed)

1. Claim the application: `npx clerk@latest auth login`, or open
   <https://dashboard.clerk.com> and claim it there.
2. **Settings → General → Application name** → **Murmur** (also used by the
   `app.name` variable in every email template).
3. **Customization → Emails** → review the verification, reset-code and
   password-changed templates; they now read “Murmur”.

This fixes the sender name and the body immediately. The `[Development]` prefix and
the `@accounts.dev` address are added by Clerk for every development instance and
cannot be changed while the app stays in development.

### Sender address on your own domain (production only)

In the production instance:

1. **Customization → Emails** → add your sending domain (Clerk shows the SPF/DKIM
   DNS records to add at your registrar).
2. Set the sender name to **Murmur** and the address on your domain, e.g.
   `noreply@murmur.example.com`.
3. Edit the templates so no footer or body text mentions Clerk.
4. Send a test reset email and confirm the sender, subject (no `[Development]`)
   and footer.

## 6. Test

1. Open the site in a private window and choose **Continue with Google**.
2. Google's chooser must say **“to continue to Murmur”**, with Murmur's privacy
   policy and terms linked.
3. Finish the flow, land on `/sso-callback`, then the feed.
4. Sign out, reset a password, and confirm the email shows Murmur.

---

## Notes

- The production instance is a **separate user pool**. Users created on the
  development instance keep their `clerkId` in MongoDB but cannot sign in there;
  a clean demo database is usually the simplest option.
- Rotate the `sk_test_…` key that was visible in screenshots. Treat it as leaked.
- Google's chooser is served from `accounts.google.com`; it can never be styled or
  removed by the app. Custom credentials change the name it shows, nothing else.
