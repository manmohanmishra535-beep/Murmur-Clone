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
import {
  clerkErrorMessage,
  hasPasswordPolicy,
  passwordHint,
  passwordPolicy,
  validatePassword,
} from "@/lib/clerk";
import { safeNextPath } from "@/lib/navigation";

const EMPTY = { email: "", password: "", code: "" };

/**
 * A Murmur-branded sign-up form over Clerk's API. Email and password create
 * the account, then a six-digit code proves the address; Google skips the
 * form. The @handle is assigned by the API (backend/services/userProvisioning).
 */
export default function RegisterPage() {
  const router = useRouter();
  const clerk = useClerk();
  const { status } = useAuth();
  const nextPath = safeNextPath(router.query.next);

  // Clerk knows the instance's password policy; AuthProvider re-renders this
  // page when the SDK finishes loading, so the hint picks up the real rule.
  const policy = passwordPolicy(clerk);

  const [step, setStep] = useState("form");
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, router, nextPath]);

  // /login links here with ?email= when that address has no account.
  useEffect(() => {
    const prefill = typeof router.query.email === "string" ? router.query.email : "";
    if (prefill) setValues((current) => (current.email ? current : { ...current, email: prefill }));
  }, [router.query.email]);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  async function finish(resource) {
    await clerk.setActive({ session: resource.createdSessionId });
    await router.replace(nextPath);
  }

  async function handleCreate(event) {
    event.preventDefault();
    clearFeedback();
    if (!values.email.trim()) return setError("Enter your email address.");
    const passwordMessage = validatePassword(values.password, policy);
    if (passwordMessage) return setError(passwordMessage);

    setBusy(true);
    try {
      const signUp = clerk.client?.signUp;
      if (!signUp) return setError("Sign-up is still loading. Try again in a moment.");

      const attempt = await signUp.create({
        emailAddress: values.email.trim(),
        password: values.password,
      });
      if (attempt.status === "complete") return await finish(attempt);

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
      setNotice(`We sent a six-digit code to ${values.email.trim()}.`);
    } catch (err) {
      setError(clerkErrorMessage(err, "That account could not be created."));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    clearFeedback();
    if (!values.code.trim()) return setError("Enter the code from the email.");

    setBusy(true);
    try {
      const signUp = clerk.client?.signUp;
      if (!signUp) return setError("Sign-up is still loading. Try again in a moment.");

      const attempt = await signUp.attemptEmailAddressVerification({ code: values.code.trim() });
      if (attempt.status === "complete") return await finish(attempt);
      return setError("That code did not finish the account. Request a new one.");
    } catch (err) {
      setError(clerkErrorMessage(err, "That code was not accepted."));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    clearFeedback();
    setBusy(true);
    try {
      const signUp = clerk.client?.signUp;
      if (!signUp) return setError("Sign-up is still loading. Try again in a moment.");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(clerkErrorMessage(err, "That code could not be resent."));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    clearFeedback();
    setBusy(true);
    try {
      const signUp = clerk.client?.signUp;
      if (!signUp) {
        setBusy(false);
        return setError("Sign-up is still loading. Try again in a moment.");
      }
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: nextPath,
      });
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-up is unavailable right now."));
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{`${step === "verify" ? "Check your inbox" : "Create an account"} · Murmur`}</title>
      </Head>

      <AuthLayout
        title={step === "verify" ? "Check your inbox" : "Create your account"}
        subtitle={
          step === "verify"
            ? "One code proves the address is yours, then you are in."
            : "A quiet place for short posts, replies and messages."
        }
        footer={
          <p>
            Already here?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Log in
            </Link>
          </p>
        }
      >
        {step === "form" ? (
          <>
            <GoogleButton onClick={handleGoogle} disabled={busy} />

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-3">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleCreate} method="post" noValidate className="flex flex-col gap-4">
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

              <Input
                id="password"
                name="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                hint={hasPasswordPolicy(clerk) ? passwordHint(policy) : "Use a strong password."}
                value={values.password}
                onChange={change}
                disabled={busy}
              />

              <Button type="submit" loading={busy} className="mt-1 w-full">
                Create account
              </Button>

              {/* Clerk mounts its bot-protection widget here when the instance asks for it. */}
              <div id="clerk-captcha" />
            </form>
          </>
        ) : null}

        {step === "verify" ? (
          <form onSubmit={handleVerify} method="post" noValidate className="flex flex-col gap-4">
            {notice ? <FormAlert tone="notice">{notice}</FormAlert> : null}
            {error ? <FormAlert>{error}</FormAlert> : null}

            <Input
              id="code"
              name="code"
              label="Six-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={values.code}
              onChange={change}
              disabled={busy}
            />

            <Button type="submit" loading={busy} className="w-full">
              Verify email
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={resendCode}
                disabled={busy}
                className="font-medium text-accent hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  setValues((current) => ({ ...current, code: "" }));
                  setStep("form");
                }}
                className="text-ink-2 hover:underline"
              >
                Use a different email
              </button>
            </div>
          </form>
        ) : null}
      </AuthLayout>
    </>
  );
}
