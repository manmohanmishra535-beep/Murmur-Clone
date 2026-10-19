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
import { validateRegister } from "@/lib/validation";
import { safeNextPath } from "@/lib/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const { register, status } = useAuth();
  const { toast } = useToast();

  const [values, setValues] = useState({ username: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeNextPath(router.query.next);

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

    const found = validateRegister(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError("");

    try {
      await register({
        username: values.username.trim().toLowerCase(),
        email: values.email.trim(),
        password: values.password,
      });
      toast("Account created. Welcome to Murmur.", { variant: "success" });
      router.replace(nextPath === "/" ? "/" : nextPath);
    } catch (error) {
      const fields = errorFields(error);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(errorMessage(error, "Could not create your account."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create your account · Murmur</title>
      </Head>

      <AuthLayout
        title="Create your account"
        subtitle="Short posts, quiet interface. No algorithm, no noise."
        footer={
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Log in
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
            id="username"
            name="username"
            label="Username"
            placeholder="priya_nair"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={change}
            error={errors.username}
            hint="3 to 15 characters. Letters, numbers, underscores."
            disabled={submitting}
          />

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
            hint="Enter a full address, like name@example.com."
            disabled={submitting}
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={values.password}
            onChange={change}
            error={errors.password}
            hint="At least 8 characters."
            disabled={submitting}
          />

          <Button type="submit" loading={submitting} className="mt-1 w-full">
            Create account
          </Button>
        </form>
      </AuthLayout>
    </>
  );
}
