import Head from "next/head";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Google sends the browser back here. Clerk completes the OAuth handshake and
 * forwards to the URL given as redirectUrlComplete when the flow started.
 */
export default function SSOCallbackPage() {
  return (
    <>
      <Head>
        <title>Signing in · Murmur</title>
      </Head>
      <main className="grid min-h-dvh place-items-center bg-bg text-ink">
        <p role="status" className="text-sm text-ink-3">
          Finishing sign-in…
        </p>
        <AuthenticateWithRedirectCallback />
      </main>
    </>
  );
}
