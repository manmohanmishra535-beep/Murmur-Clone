import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useClerk } from "@clerk/nextjs";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Button";
import FormAlert from "@/components/FormAlert";
import GoogleButton from "@/components/GoogleButton";
import Input from "@/components/Input";
import { useAuth } from "@/hooks/useAuth";
import { clerkErrorMessage, isIdentifierNotFound } from "@/lib/clerk";
import { safeNextPath } from "@/lib/navigation";

const EMPTY = { email: "", password: "", code: "", newPassword: "" };

/**
 * A Murmur-branded sign-in form over Clerk's API. The prebuilt <SignIn> would
 * carry Clerk's own branding; this owns the markup and leaves Clerk to the
 * session work. Email/password, Google, and the reset-code flow live here.
 */
export default function LoginPage() {
  const router = useRouter();
  const clerk = useClerk();
  const { status } = useAuth();
  const nextPath = safeNextPath(router.query.next);

  const [mode, setMode] = useState("signIn");
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  // Already signed in? Go where you were headed.
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, router, nextPath]);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function clearFeedback() {
    setError("");
    setNotice("");
    setNotFound(false);
  }

  function switchMode(next) {
    clearFeedback();
    setValues((current) => ({ ...current, code: "", newPassword: "" }));
    setMode(next);
  }

  /** Clerk created a session: hand it to the provider and leave the page. */
  async function finish(resource) {
    await clerk.setActive({ session: resource.createdSessionId });
    await router.replace(nextPath);
  }

  async function handleSignIn(event) {
    event.preventDefault();
    clearFeedback();
    if (!values.email.trim()) return setError("Enter your email address.");
    if (!values.password) return setError("Enter your password.");

    setBusy(true);
    try {
      const signIn = clerk.client?.signIn;
      if (!signIn) return setError("Sign-in is still loading. Try again in a moment.");

      const attempt = await signIn.create({
        identifier: values.email.trim(),
        password: values.password,
      });
      if (attempt.status === "complete") return await finish(attempt);
      if (attempt.status === "needs_second_factor") {
        return setError(
          "This account uses two-factor authentication, which this form does not support yet."
        );
      }
      return setError("This account needs another verification step. Try again in a private window.");
    } catch (err) {
      setNotFound(isIdentifierNotFound(err));
      setError(clerkErrorMessage(err, "That email and password did not work."));
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(event) {
    event.preventDefault();
    clearFeedback();
    if (!values.email.trim()) return setError("Enter your email address first.");

    setBusy(true);
    try {
      const signIn = clerk.client?.signIn;
      if (!signIn) return setError("Sign-in is still loading. Try again in a moment.");

      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: values.email.trim(),
      });
      setMode("resetVerify");
      setNotice("If that address has an account, a reset code is on its way.");
    } catch (err) {
      setError(clerkErrorMessage(err, "That reset could not be started."));
    } finally {
      setBusy(false);
    }
  }

  async function completeReset(event) {
    event.preventDefault();
    clearFeedback();
    if (!values.code.trim()) return setError("Enter the code from the email.");
    if (values.newPassword.length < 8) return setError("Use at least 8 characters for the new password.");

    setBusy(true);
    try {
      const signIn = clerk.client?.signIn;
      if (!signIn) return setError("Sign-in is still loading. Try again in a moment.");

      const attempt = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: values.code.trim(),
        password: values.newPassword,
      });
      if (attempt.status === "complete") return await finish(attempt);
      return setError("That code did not finish the reset. Request a new one.");
    } catch (err) {
      setError(clerkErrorMessage(err, "That code was not accepted."));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    clearFeedback();
    setBusy(true);
    try {
      const signIn = clerk.client?.signIn;
      if (!signIn) {
        setBusy(false);
        return setError("Sign-in is still loading. Try again in a moment.");
      }
      // This navigates to Google and back to /sso-callback, which finishes the
      // handshake and sends the browser to nextPath.
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: nextPath,
      });
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-in is unavailable right now."));
      setBusy(false);
    }
  }

  const titles = {
    signIn: "Log in to Murmur",
    resetRequest: "Reset your password",
    resetVerify: "Enter the reset code",
  };
  const subtitles = {
    signIn: "Pick up the conversation where you left it.",
    resetRequest: "We will email a code to the address on the account.",
    resetVerify: "Check the inbox for the code, then choose a new password.",
  };

  return (
    <>
      <Head>
        <title>{`${mode === "signIn" ? "Log in" : "Reset your password"} · Murmur`}</title>
      </Head>

      <AuthLayout
        title={titles[mode]}
        subtitle={subtitles[mode]}
        footer={
          mode === "signIn" ? (
            <p>
              New here?{" "}
              <Link href="/register" className="font-semibold text-accent hover:underline">
                Create an account
              </Link>
            </p>
          ) : (
            <p>
              Remembered it?{" "}
              <button
                type="button"
                onClick={() => switchMode("signIn")}
                className="font-semibold text-accent hover:underline"
              >
                Back to log in
              </button>
            </p>
          )
        }
      >
        {mode === "signIn" ? (
          <>
            <GoogleButton onClick={handleGoogle} disabled={busy} />

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-3">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleSignIn} method="post" noValidate className="flex flex-col gap-4">
              {error ? <FormAlert>{error}</FormAlert> : null}

              <Input
                id="email"
                name="email"
                label="Email address"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={values.email}
                onChange={change}
                disabled={busy}
              />

              <div className="flex flex-col gap-1.5">
                <Input
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={values.password}
                  onChange={change}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => switchMode("resetRequest")}
                  className="self-end text-sm font-medium text-accent hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" loading={busy} className="mt-1 w-full">
                Log in
              </Button>

              {notFound ? (
                <p className="text-sm text-ink-2">
                  No account uses that address.{" "}
                  <Link
                    href={`/register?email=${encodeURIComponent(values.email.trim())}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    Create one
                  </Link>
                  .
                </p>
              ) : null}

              {/* Clerk mounts its bot-protection widget here when the instance asks for it. */}
              <div id="clerk-captcha" />
            </form>
          </>
        ) : null}

        {mode === "resetRequest" ? (
          <form onSubmit={requestReset} method="post" noValidate className="flex flex-col gap-4">
            {error ? <FormAlert>{error}</FormAlert> : null}

            <Input
              id="reset-email"
              name="email"
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              onChange={change}
              disabled={busy}
            />

            <Button type="submit" loading={busy} className="w-full">
              Send reset code
            </Button>
          </form>
        ) : null}

        {mode === "resetVerify" ? (
          <form onSubmit={completeReset} method="post" noValidate className="flex flex-col gap-4">
            {notice ? <FormAlert tone="notice">{notice}</FormAlert> : null}
            {error ? <FormAlert>{error}</FormAlert> : null}

            <Input
              id="reset-code"
              name="code"
              label="Reset code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={values.code}
              onChange={change}
              disabled={busy}
            />

            <Input
              id="reset-password"
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters."
              value={values.newPassword}
              onChange={change}
              disabled={busy}
            />

            <Button type="submit" loading={busy} className="w-full">
              Set new password
            </Button>

            <button
              type="button"
              onClick={() => switchMode("resetRequest")}
              className="text-sm font-medium text-accent hover:underline"
            >
              Send a new code
            </button>
          </form>
        ) : null}
      </AuthLayout>
    </>
  );
}
