import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import clsx from "clsx";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import Composer from "@/components/Composer";
import Input from "@/components/Input";
import NavItem from "@/components/NavItem";
import PostCard from "@/components/PostCard";
import Tabs from "@/components/Tabs";
import { BellIcon, HomeIcon, SearchIcon } from "@/components/icons";
import { useToast } from "@/hooks/useToast";
import { MOCK_POSTS } from "@/lib/mockPosts";
import { compactNumber } from "@/lib/format";
import { counterTone, remainingCharacters } from "@/lib/composer";
import { applyTheme, getStoredTheme, THEMES } from "@/lib/theme";

const COLORS = [
  { token: "bg", light: "#F5F7F6", dark: "#0B1110", use: "Page background" },
  { token: "surface", light: "#FFFFFF", dark: "#121A18", use: "Posts, cards, inputs" },
  { token: "surface-2", light: "#EBF0EE", dark: "#1A2522", use: "Hover, chips, search" },
  { token: "line", light: "#D9E1DE", dark: "#26332F", use: "Dividers and borders" },
  { token: "ink", light: "#0F1714", dark: "#EAF1EE", use: "Primary text" },
  { token: "ink-2", light: "#4A5A55", dark: "#A7B8B2", use: "Secondary copy" },
  { token: "ink-3", light: "#5F706A", dark: "#8A9C96", use: "Handles, counts, meta" },
  { token: "accent", light: "#0A7F66", dark: "#2FD0A6", use: "Actions, links, identity" },
  { token: "accent-ink", light: "#FFFFFF", dark: "#06231C", use: "Text on accent" },
  { token: "accent-soft", light: "#DDF1EB", dark: "#14322A", use: "Tint, avatar fallback" },
  { token: "like", light: "#C7284F", dark: "#FF7A98", use: "Liked heart only" },
  { token: "like-soft", light: "#FBE4EA", dark: "#3A1B26", use: "Like hover tint" },
  { token: "warn", light: "#9A4A06", dark: "#F0A04B", use: "Counter warning" },
  { token: "danger", light: "#B3261E", dark: "#FF8A80", use: "Errors, destructive" },
];

const TYPE = [
  { token: "3xl", px: "44", sample: "Say it short.", className: "text-3xl font-display font-semibold" },
  { token: "2xl", px: "30", sample: "Priya Nair", className: "text-2xl font-display font-semibold" },
  { token: "xl", px: "22", sample: "Home", className: "text-xl font-display font-semibold" },
  { token: "lg", px: "18", sample: "What is happening on your street today?", className: "text-lg" },
  { token: "md", px: "15", sample: "Post body — Instrument Sans carries every post.", className: "text-base" },
  { token: "sm", px: "13", sample: "@priya · 2h · Mumbai", className: "text-sm text-ink-3" },
  { token: "xs", px: "12", sample: "1,284 reposts", className: "text-xs text-ink-3" },
];

const SPACES = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const RADII = [
  { token: "sm", px: "6px" },
  { token: "md", px: "12px" },
  { token: "lg", px: "18px" },
  { token: "pill", px: "999px" },
];
const MOTION = [
  { token: "--dur-fast", value: "120ms", use: "Hover colour, press scale" },
  { token: "--dur-base", value: "200ms", use: "Toasts, menus, tab indicator" },
  { token: "--dur-slow", value: "320ms", use: "Like pop, composer expand" },
  { token: "--ease-out", value: ".2, .8, .2, 1", use: "Everything" },
];

function Section({ id, title, intro, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <h2
        id={`${id}-title`}
        className="border-b border-line pb-3 font-display text-2xl font-semibold tracking-tight text-ink"
      >
        {title}
      </h2>
      {intro ? <p className="mt-3 max-w-2xl text-base text-ink-2">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({ token, light, dark, use }) {
  const { toast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(`var(--${token})`);
      toast(`Copied var(--${token})`, { variant: "success" });
    } catch {
      toast(`var(--${token})`, { variant: "info" });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="overflow-hidden rounded-lg border border-line bg-surface text-left transition-colors duration-fast hover:border-ink-3"
      title={`Copy var(--${token})`}
    >
      <span
        aria-hidden="true"
        className="block h-16 w-full border-b border-line"
        style={{ background: `var(--${token})` }}
      />
      <span className="block p-3">
        <span className="block font-mono text-xs font-medium text-ink">{token}</span>
        <span className="mt-1 block text-xs text-ink-2">{use}</span>
        <span className="mt-1 block font-mono text-[11px] leading-relaxed text-ink-3">
          {light} / {dark}
        </span>
      </span>
    </button>
  );
}

export default function DesignSystemPage() {
  const { toast } = useToast();
  const [theme, setTheme] = useState("system");
  const [tab, setTab] = useState("for-you");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function chooseTheme(next) {
    setTheme(next);
    applyTheme(next);
  }

  const remaining = remainingCharacters(draft);

  return (
    <>
      <Head>
        <title>Murmur design system v1.0</title>
      </Head>

      <main className="min-h-dvh bg-bg text-ink">
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2" aria-label="Murmur home">
              <span className="grid h-8 w-8 place-items-center rounded-pill bg-accent font-display text-lg font-bold lowercase text-accent-ink">
                m
              </span>
              <span className="font-display text-lg font-semibold">Murmur</span>
            </Link>

            <span aria-hidden="true" className="text-ink-3">
              /
            </span>
            <span className="font-display text-lg font-semibold text-ink-2">Design system</span>
            <span className="rounded-pill border border-line px-2 py-0.5 font-mono text-[11px] text-ink-3">
              v1.0
            </span>

            <div role="radiogroup" aria-label="Theme" className="ml-auto flex gap-1 rounded-pill bg-surface-2 p-1">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.value}
                  onClick={() => chooseTheme(option.value)}
                  className={clsx(
                    "h-8 rounded-pill px-3 text-xs font-medium transition-colors duration-fast",
                    theme === option.value
                      ? "bg-surface text-ink shadow-1"
                      : "text-ink-3 hover:text-ink"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 pb-24">
          <section className="border-b border-line py-12">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Foundations, components, layout
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.05] tracking-tight">
              Short posts, quiet interface.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-2">
              Tokens, components and layout rules for a text-first microblogging app.
              Content carries the page; the interface stays out of its way. Every value
              below is read live from the same CSS variables the app imports from{" "}
              <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-sm">
                tokens.css
              </code>
              .
            </p>
            <p className="mt-4 text-sm text-ink-3">
              Switch the theme above. Tailwind reads the same variables, so no rebuild is
              involved.
            </p>
          </section>

          <div className="flex flex-col gap-16 py-12">
            <Section
              id="color"
              title="Color"
              intro="One accent, used for actions and identity. Like and error colours stay separate so a heart never reads as a button. Click any swatch to copy its variable name."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {COLORS.map((color) => (
                  <Swatch key={color.token} {...color} />
                ))}
              </div>
              <p className="mt-4 text-sm text-ink-3">
                All body pairings meet WCAG AA (4.5:1) in both themes. State is never
                shown by colour alone.
              </p>
            </Section>

            <Section
              id="type"
              title="Type"
              intro="Bricolage Grotesque names things: titles, display names, navigation. Instrument Sans carries every post. JetBrains Mono is reserved for counts in code and token names."
            >
              <div className="divide-y divide-line rounded-lg border border-line bg-surface">
                {TYPE.map((row) => (
                  <div key={row.token} className="flex flex-wrap items-baseline gap-4 px-4 py-4">
                    <span className="w-24 shrink-0 font-mono text-xs text-ink-3">
                      {row.token} · {row.px}
                    </span>
                    <span className={clsx("min-w-0 break-words text-ink", row.className)}>
                      {row.sample}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="space"
              title="Space, shape, elevation, motion"
              intro="Spacing runs on a 4px base. Posts use 16px padding and 12px between avatar and text. Pills are for actions and tabs; 12px and 18px radii are for containers."
            >
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="font-display text-lg font-semibold">Spacing</h3>
                  <ul className="mt-3 space-y-2">
                    {SPACES.map((step) => (
                      <li key={step} className="flex items-center gap-3 text-sm">
                        <span className="w-20 shrink-0 font-mono text-xs text-ink-3">
                          space-{step}
                        </span>
                        <span
                          aria-hidden="true"
                          className="h-2 rounded-pill bg-accent-soft"
                          style={{ width: `var(--space-${step})`, minWidth: 4 }}
                        />
                        <span className="font-mono text-xs text-ink-3">{step * 4}px</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-display text-lg font-semibold">Radius</h3>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {RADII.map((radius) => (
                      <div key={radius.token} className="flex flex-col items-center gap-1">
                        <span
                          aria-hidden="true"
                          className="h-16 w-16 border border-line bg-surface-2"
                          style={{ borderRadius: `var(--radius-${radius.token})` }}
                        />
                        <span className="font-mono text-[11px] text-ink-3">
                          {radius.token} · {radius.px}
                        </span>
                      </div>
                    ))}
                  </div>

                  <h3 className="mt-8 font-display text-lg font-semibold">Elevation</h3>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="flex h-16 w-32 items-center justify-center rounded-md border border-line bg-surface text-xs text-ink-3 shadow-1">
                      shadow-1
                    </div>
                    <div className="flex h-16 w-32 items-center justify-center rounded-md border border-line bg-surface text-xs text-ink-3 shadow-2">
                      shadow-2
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Motion tokens</caption>
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Token</th>
                      <th scope="col" className="px-3 py-2 font-medium">Value</th>
                      <th scope="col" className="px-3 py-2 font-medium">Use</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {MOTION.map((row) => (
                      <tr key={row.token}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink">{row.token}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-3">{row.value}</td>
                        <td className="px-3 py-2 text-ink-2">{row.use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-ink-3">
                Reduced motion sets every duration token to zero.
              </p>
            </Section>

            <Section
              id="buttons"
              title="Buttons"
              intro="Variants primary, secondary, ghost and danger. 40px height, 32px small. One primary button per view, and disabled is a state rather than a removal."
            >
              <div className="flex flex-wrap items-center gap-3">
                <Button>Post</Button>
                <Button variant="secondary">Following</Button>
                <Button variant="ghost">Show more</Button>
                <Button variant="danger">Delete post</Button>
                <Button variant="primary" loading>
                  Posting
                </Button>
                <Button disabled>Post</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="sm">Small primary</Button>
                <Button size="sm" variant="secondary">Small secondary</Button>
                <Button size="sm" variant="ghost">Small ghost</Button>
              </div>
            </Section>

            <Section
              id="inputs"
              title="Inputs"
              intro="44px tall, accent focus treatment, and error text under the field. Hints and errors are wired to the input with aria-describedby."
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Input
                  id="demo-username"
                  label="Username"
                  defaultValue="priya_nair"
                  hint="3 to 15 characters. Letters, numbers, underscores."
                />
                <Input
                  id="demo-email"
                  label="Email"
                  defaultValue="priya@"
                  error="Enter a full address, like name@example.com."
                />
                <Input
                  id="demo-search"
                  label="Search Murmur"
                  placeholder="Search Murmur"
                  leading={<SearchIcon size={18} />}
                  readOnly
                />
                <Input
                  id="demo-disabled"
                  label="Disabled"
                  placeholder="Not available yet"
                  disabled
                />
              </div>
            </Section>

            <Section id="avatars" title="Avatars" intro="Sizes 32, 44 and 96. Initials fall back to accent-soft.">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <Avatar size={32} name="Priya Nair" username="priya" />
                  <span className="font-mono text-[11px] text-ink-3">32</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Avatar size={44} name="Rohan Shah" username="rohan_s" />
                  <span className="font-mono text-[11px] text-ink-3">44</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Avatar size={96} name="Priya Nair" username="priya" />
                  <span className="font-mono text-[11px] text-ink-3">96</span>
                </div>
              </div>
            </Section>

            <Section id="navigation" title="Navigation" intro="48px tall, display font, unread badge in accent.">
              <div className="max-w-xs rounded-lg border border-line bg-surface p-2">
                <NavItem href="/" label="Home" icon={HomeIcon} active onClick={() => {}} />
                <NavItem href="/" label="Explore" icon={SearchIcon} onClick={() => {}} />
                <NavItem href="/" label="Notifications" icon={BellIcon} badge={3} onClick={() => {}} />
              </div>
            </Section>

            <Section
              id="tabs"
              title="Tabs and post cards"
              intro="Tabs are 48px tall with a 4px accent underline. Post cards use a 44px avatar column, 16px padding and tabular counts."
            >
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                <Tabs
                  label="Feed tabs"
                  value={tab}
                  onChange={setTab}
                  items={[
                    { key: "for-you", label: "For you" },
                    { key: "following", label: "Following" },
                  ]}
                />
                <PostCard post={{ ...MOCK_POSTS[0], mediaPlaceholder: true }} />
                <PostCard post={MOCK_POSTS[1]} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-3">
                <span>Compact count check:</span>
                <span className="font-mono text-xs text-ink">
                  {compactNumber(1284)} · {compactNumber(10200)} · {compactNumber(1250000)}
                </span>
              </div>
            </Section>

            <Section
              id="composer"
              title="Composer"
              intro="18px input, a 280-character ring counter, and a post button that is disabled when the draft is empty or over the limit."
            >
              <div className="overflow-hidden rounded-lg border border-line">
                <Composer
                  id="design-composer"
                  currentUser={{ username: "priya", displayName: "Priya Nair" }}
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() =>
                    toast(`Draft is ${remaining} characters under the limit.`, {
                      variant: "success",
                    })
                  }
                  allowImages={false}
                />
              </div>
              <p className="mt-3 text-sm text-ink-3">
                Ring tone:{" "}
                <span className="font-mono text-xs text-ink">
                  {counterTone(remaining)}
                </span>{" "}
                · {remaining} remaining
              </p>
            </Section>

            <Section
              id="toasts"
              title="Toasts"
              intro="Bottom centre, 2.2 seconds, role=status. Errors also carry a message, never colour alone."
            >
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => toast("Profile saved.", { variant: "success" })}
                >
                  Show success toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toast("Cannot reach the Murmur API.", { variant: "error" })}
                >
                  Show error toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toast("Draft kept for later.", { variant: "info" })}
                >
                  Show info toast
                </Button>
              </div>
            </Section>

            <Section id="rules" title="Rules and anti-rules">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-accent bg-surface p-4">
                  <h3 className="font-display text-lg font-semibold text-accent">Do</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-2">
                    <li>Show counts with tabular numerals and compact units above 9,999.</li>
                    <li>Keep action icons at 18px with an 8px hit padding.</li>
                    <li>Use a 2px accent outline with 2px offset on every focusable element.</li>
                    <li>Toggle actions use aria-pressed and an updated label.</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-danger bg-surface p-4">
                  <h3 className="font-display text-lg font-semibold text-danger">Don&apos;t</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-2">
                    <li>Use the accent for likes. The heart is the only like-coloured thing.</li>
                    <li>Show more than one primary button per screen.</li>
                    <li>Hide the post button; disable it instead.</li>
                    <li>Convey state by colour alone. Fill the heart, write the error.</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section
              id="layout"
              title="App shell"
              intro="Three columns from 1000px: 232px navigation, a 600px feed and a 340px rail. Below 720px the rail disappears and navigation moves to a bottom bar."
            >
              <div className="overflow-hidden rounded-lg border border-line bg-surface-2 p-2">
                <div className="flex h-40 items-stretch gap-2 text-center text-xs text-ink-3">
                  <div className="flex w-[20%] items-center justify-center rounded-md border border-line bg-surface">
                    Nav
                    <br />
                    232 / 72
                  </div>
                  <div className="flex flex-1 items-center justify-center rounded-md border border-line bg-surface">
                    Feed · max 600
                  </div>
                  <div className="hidden w-[28%] items-center justify-center rounded-md border border-line bg-surface sm:flex">
                    Rail · 340
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Breakpoints</caption>
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Breakpoint</th>
                      <th scope="col" className="px-3 py-2 font-medium">Min width</th>
                      <th scope="col" className="px-3 py-2 font-medium">Behaviour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-ink">base</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-3">0</td>
                      <td className="px-3 py-2 text-ink-2">Single column, bottom tab bar, floating post button</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-ink">md</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-3">720px</td>
                      <td className="px-3 py-2 text-ink-2">Compact icon nav + feed</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-ink">lg</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-3">1000px</td>
                      <td className="px-3 py-2 text-ink-2">Full nav + feed + right rail</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink-2">
{`<article className="grid grid-cols-[44px_1fr] gap-3 p-4 border-b border-line
  bg-surface hover:bg-surface-2">
  <b className="font-body text-ink">Priya</b>
  <span className="text-sm text-ink-3">@priya · 2h</span>
</article>`}
              </pre>
            </Section>
          </div>
        </div>
      </main>
    </>
  );
}
