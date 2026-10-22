import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@/styles/tokens.css";
import "@/styles/globals.css";

import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { SocketProvider } from "@/context/SocketContext";

// Login, register, the OAuth callback and the design-system reference sit
// outside the app shell.
const BARE_ROUTES = new Set(["/login", "/register", "/sso-callback", "/design"]);

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Render's free instance sleeps after 15 minutes. A cold start can
            // outlast one 15s request, so network failures get three attempts
            // with a 5s gap; a 401/403 is final and never retried.
            retry: (failureCount, error) => {
              const status = error && error.response && error.response.status;
              if (status === 401 || status === 403) return false;
              if (!error || !error.response) return failureCount < 2;
              return failureCount < 1;
            },
            retryDelay: (attemptIndex, error) =>
              error && !error.response
                ? 5_000
                : Math.min(1_000 * 2 ** attemptIndex, 8_000),
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const bare = BARE_ROUTES.has(router.pathname);

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <SocketProvider>
              <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta
                  name="description"
                  content="Murmur is a quiet, text-first microblogging app."
                />
              </Head>

              {bare ? (
                <Component {...pageProps} />
              ) : (
                <AppShell>
                  <Component {...pageProps} />
                </AppShell>
              )}
            </SocketProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
