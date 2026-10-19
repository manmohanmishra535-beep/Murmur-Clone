import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import PageHeader from "@/components/PageHeader";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import { LogoutIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { errorFields, errorMessage } from "@/services/api";
import { userService } from "@/services/userService";
import { BIO_MAX, validateProfile } from "@/lib/validation";
import { applyTheme, getStoredTheme, THEMES } from "@/lib/theme";
import { joinedDate } from "@/lib/format";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

export default function SettingsPage() {
  const router = useRouter();
  const { user, status, updateUser, logout } = useAuth();
  const { toast } = useToast();

  const [values, setValues] = useState({ displayName: "", bio: "" });
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [theme, setThemeState] = useState("system");

  const fileRef = useRef(null);

  useEffect(() => {
    if (status === "guest") router.replace("/login?next=%2Fsettings");
  }, [status, router]);

  useEffect(() => {
    if (!user) return;
    setValues({ displayName: user.displayName || "", bio: user.bio || "" });
  }, [user]);

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  // Object URLs must be revoked, or the blob leaks for the tab's lifetime.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function pickFile(event) {
    const next = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!next) return;

    if (!ALLOWED_IMAGE_TYPES.includes(next.type)) {
      toast("Use a JPEG, PNG, WebP or GIF image.", { variant: "error" });
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      toast("Images must be 5 MB or smaller.", { variant: "error" });
      return;
    }
    setFile(next);
  }

  async function save(event) {
    event.preventDefault();

    const found = validateProfile(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const updated = await userService.updateMe({
        displayName: values.displayName.trim(),
        bio: values.bio.trim(),
        imageFile: file || undefined,
      });
      updateUser(updated);
      setFile(null);
      toast("Profile saved.", { variant: "success" });
    } catch (error) {
      const fields = errorFields(error);
      if (Object.keys(fields).length) setErrors(fields);
      else toast(errorMessage(error, "Could not save your profile."), { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function chooseTheme(next) {
    setThemeState(next);
    applyTheme(next);
    toast(
      next === "system" ? "Theme follows your system." : `${next[0].toUpperCase()}${next.slice(1)} theme on.`,
      { variant: "success" }
    );
  }

  async function handleLogout() {
    await logout();
    toast("You are logged out.", { variant: "success" });
    router.replace("/login");
  }

  if (!user) {
    return (
      <>
        <Head>
          <title>Settings · Murmur</title>
        </Head>
        <PageHeader title="Settings" />
      </>
    );
  }

  const bioCount = values.bio.length;
  const overBio = bioCount > BIO_MAX;

  return (
    <>
      <Head>
        <title>Settings · Murmur</title>
      </Head>

      <PageHeader title="Settings" subtitle={`@${user.username}`} />

      <form onSubmit={save} noValidate className="divide-y divide-line">
        <section className="p-4" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="font-display text-lg font-semibold">
            Profile
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            This is how you appear across Murmur.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Avatar
              size={96}
              src={preview || user.profileImage}
              name={values.displayName || user.displayName}
              username={user.username}
            />

            <div className="flex flex-col items-start gap-1">
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                onChange={pickFile}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
              >
                Change photo
              </Button>
              <p className="text-xs text-ink-3">JPEG, PNG, WebP or GIF. Up to 5 MB.</p>
              {file ? (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs font-medium text-danger hover:underline"
                >
                  Remove new photo
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <Input
              id="displayName"
              name="displayName"
              label="Display name"
              value={values.displayName}
              onChange={change}
              error={errors.displayName}
              maxLength={60}
              hint="Up to 50 characters. Defaults to your username."
              disabled={saving}
            />

            <Textarea
              id="bio"
              name="bio"
              label="Bio"
              rows={3}
              value={values.bio}
              onChange={change}
              error={errors.bio}
              hint={`${bioCount}/${BIO_MAX} characters`}
              className={overBio ? "border-danger" : undefined}
              disabled={saving}
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="submit" loading={saving}>
              Save profile
            </Button>
          </div>
        </section>

        <section className="p-4" aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="font-display text-lg font-semibold">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            The choice is stored on this device. Tailwind reads the same tokens, so
            switching never needs a rebuild.
          </p>

          <div role="radiogroup" aria-label="Theme" className="mt-4 flex flex-wrap gap-2">
            {THEMES.map((option) => {
              const Icon = THEME_ICONS[option.value];
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseTheme(option.value)}
                  className={
                    "flex h-11 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors duration-fast " +
                    (active
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink")
                  }
                >
                  <Icon size={18} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="p-4" aria-labelledby="account-heading">
          <h2 id="account-heading" className="font-display text-lg font-semibold">
            Account
          </h2>

          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-2">Email</dt>
              <dd className="text-ink">{user.email}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-2">Username</dt>
              <dd className="text-ink">@{user.username}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-2">Joined</dt>
              <dd className="text-ink">{joinedDate(user.createdAt).replace("Joined ", "")}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <Button type="button" variant="secondary" onClick={handleLogout}>
              <LogoutIcon size={18} />
              Log out
            </Button>
          </div>
        </section>
      </form>
    </>
  );
}
