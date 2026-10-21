import { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { SignIn } from "@clerk/nextjs";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { safeNextPath } from "@/lib/navigation";

/**
 * Clerk renders the whole sign-in flow here: email/password, social providers
 * (whatever the instance has enabled) and the "Forgot password?" link.
 */
export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuth();
  const nextPath = safeNextPath(router.query.next);

  // Already signed in? Go where you were headed.
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, router, nextPath]);

  return (
    <>
      <Head>
        <title>Log in · Murmur</title>
      </Head>

      <AuthLayout
        title="Log in to Murmur"
        subtitle="Pick up the conversation where you left it."
        footer={
          <p>
            New here?{" "}
            <Link href="/register" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </p>
        }
      >
        <SignIn
          routing="hash"
          signUpUrl="/register"
          fallbackRedirectUrl={nextPath}
          appearance={{ variables: { colorPrimary: "#0a7f66", borderRadius: "0.5rem" } }}
        />
      </AuthLayout>
    </>
  );
}
