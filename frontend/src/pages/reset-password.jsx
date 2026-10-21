import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/useToast";
import { errorCode, errorFields, errorMessage } from "@/services/api";
import { validateResetPassword } from "@/lib/validation";

/**
 * Step two. The token arrives in the query string, is sent once to the API and
 * is never stored: the API spends it and retires every session that used the
 * old password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // useRouter fills the query after the first client render.
  const ready = router.isReady;
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const missing = ready && !token;

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();

    const found = validateResetPassword(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError("");

    try {
      await authService.resetPassword({ token, password: values.password });
      toast("Password updated. Log in with the new one.", { variant: "success" });
      router.replace("/login");
    } catch (error) {
      const fields = errorFields(error);
      if (Object.keys(fields).length) {
        setErrors(fields);
      } else if (errorCode(error) === "INVALID_RESET_TOKEN") {
        setFormError(errorMessage(error, "That reset link no longer works."));
      } else {
        setFormError(errorMessage(error, "Could not change your password."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Choose a new password · Murmur</title>
      </Head>

      <AuthLayout
        title="Choose a new password"
        subtitle="The link works once, so pick something you will remember."
        footer={
          <p>
            Need a new link?{" "}
            <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
              Request another
            </Link>
          </p>
        }
      >
        {missing ? (
          <div className="flex flex-col gap-4">
            <div
              role="alert"
              className="rounded-md border border-danger bg-surface px-3 py-2 text-sm text-danger"
            >
              This reset link is missing its token. It may have been copied incompletely.
            </div>
            <Button onClick={() => router.push("/forgot-password")} className="w-full">
              Request a new link
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
              id="password"
              name="password"
              type="password"
              label="New password"
              hint="At least 8 characters."
              placeholder="Your new password"
              autoComplete="new-password"
              value={values.password}
              onChange={change}
              error={errors.password}
              disabled={submitting}
            />

            <Input
              id="confirm"
              name="confirm"
              type="password"
              label="Confirm password"
              placeholder="Type it again"
              autoComplete="new-password"
              value={values.confirm}
              onChange={change}
              error={errors.confirm}
              disabled={submitting}
            />

            <Button type="submit" loading={submitting} disabled={!ready} className="mt-1 w-full">
              Save new password
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
}
