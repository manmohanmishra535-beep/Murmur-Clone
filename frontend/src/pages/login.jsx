import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthLayout from "@/components/AuthLayout";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { errorFields, errorMessage } from "@/services/api";
import { validateLogin } from "@/lib/validation";
import { safeNextPath } from "@/lib/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const { toast } = useToast();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeNextPath(router.query.next);

  // Already signed in? Go where you were headed.
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, router, nextPath]);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();

    const found = validateLogin(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError("");

    try {
      await login({ email: values.email.trim(), password: values.password });
      toast("Welcome back.", { variant: "success" });
      router.replace(nextPath);
    } catch (error) {
      const fields = errorFields(error);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(errorMessage(error, "Could not log you in."));
    } finally {
      setSubmitting(false);
    }
  }

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

          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            labelAction={
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-accent hover:underline"
              >
                Forgot password?
              </Link>
            }
            placeholder="Your password"
            autoComplete="current-password"
            value={values.password}
            onChange={change}
            error={errors.password}
            disabled={submitting}
          />

          <Button type="submit" loading={submitting} className="mt-1 w-full">
            Log in
          </Button>
        </form>
      </AuthLayout>
    </>
  );
}
