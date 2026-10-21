import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { authService } from "@/services/authService";
import { errorFields, errorMessage } from "@/services/api";
import { validateForgotPassword } from "@/lib/validation";

/**
 * Step one of the reset flow. The API deliberately answers the same way for a
 * known and an unknown address, so this page never learns whether an account
 * exists — it just forwards the message.
 */
export default function ForgotPasswordPage() {
  const [values, setValues] = useState({ email: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Set once the API has answered: { message, resetUrl? }.
  const [sent, setSent] = useState(null);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();

    const found = validateForgotPassword(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError("");

    try {
      setSent(await authService.forgotPassword(values.email.trim()));
    } catch (error) {
      const fields = errorFields(error);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(errorMessage(error, "Could not send the reset link."));
    } finally {
      setSubmitting(false);
    }
  }

  /** The API returns an absolute URL; keep only the path so the link stays on this origin. */
  function resetPath(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return "/forgot-password";
    }
  }

  return (
    <>
      <Head>
        <title>Reset your password · Murmur</title>
      </Head>

      <AuthLayout
        title="Reset your password"
        subtitle="Enter the email on your account and we will send you a one-time link."
        footer={
          <p>
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Back to log in
            </Link>
          </p>
        }
      >
        {sent ? (
          <div className="flex flex-col gap-4">
            <div
              role="status"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-2"
            >
              {sent.message}
            </div>

            {sent.resetUrl ? (
              <div className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-ink-2">
                <p className="font-medium text-ink">Development mode</p>
                <p className="mt-1">
                  No mail server is configured, so the API returned the link instead of
                  sending it:
                </p>
                <Link
                  href={resetPath(sent.resetUrl)}
                  className="mt-2 inline-block break-all font-semibold text-accent hover:underline"
                >
                  Continue to reset password
                </Link>
              </div>
            ) : null}

            <Button variant="secondary" onClick={() => setSent(null)} className="w-full">
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {formError ? (
              <div
                role="alert"
                className="rounded-md border border-danger bg-surface px-3 py-2 text-sm text-danger"
              >
                {formError}
              </div>
            ) : null}

            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              onChange={change}
              error={errors.email}
              disabled={submitting}
            />

            <Button type="submit" loading={submitting} className="mt-1 w-full">
              Send reset link
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
}
