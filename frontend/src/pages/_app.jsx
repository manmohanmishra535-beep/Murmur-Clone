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

// Login, register and the design-system reference sit outside the app shell.
const BARE_ROUTES = new Set(["/login", "/register", "/design"]);

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
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
