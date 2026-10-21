import { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { SignUp } from "@clerk/nextjs";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/hooks/useAuth";
import { safeNextPath } from "@/lib/navigation";

/**
 * Clerk owns the form. Enable "Username" in the Clerk dashboard if you want
 * people to choose their @handle here; otherwise the API derives one from the
 * email's local part (see backend/services/userProvisioning.js).
 */
export default function RegisterPage() {
  const router = useRouter();
  const { status } = useAuth();
  const nextPath = safeNextPath(router.query.next);

  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, router, nextPath]);

  return (
    <>
      <Head>
        <title>Create an account · Murmur</title>
      </Head>

      <AuthLayout
        title="Create your account"
        subtitle="A quiet place for short posts, replies and messages."
        footer={
          <p>
            Already here?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Log in
            </Link>
          </p>
        }
      >
        <SignUp
          routing="hash"
          signInUrl="/login"
          fallbackRedirectUrl={nextPath}
          appearance={{ variables: { colorPrimary: "#0a7f66", borderRadius: "0.5rem" } }}
        />
      </AuthLayout>
    </>
  );
}
