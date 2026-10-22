import Link from "next/link";

/**
 * Shared frame for /login and /register: a brand panel on wide screens and a
 * single 400px form column everywhere else.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col overflow-hidden border-r border-line bg-surface p-12 lg:flex">
        <Link href="/" className="flex items-center gap-2" aria-label="Murmur home">
          <span className="grid h-10 w-10 place-items-center rounded-pill bg-accent font-display text-2xl font-bold lowercase text-accent-ink">
            m
          </span>
          <span className="font-display text-2xl font-bold tracking-tight">Murmur</span>
        </Link>

        <div className="my-auto max-w-lg">
          <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight">
            Short posts,
            <br />
            quiet interface.
          </h2>
          <p className="mt-4 max-w-md text-lg text-ink-2">
            Content carries the page. The interface stays out of its way.
          </p>

          <figure className="mt-10 rounded-lg border border-line bg-bg p-4 shadow-1">
            <blockquote className="text-base leading-relaxed text-ink">
              “A 280 character limit is a design constraint, not a bug. Say less, mean more.”
            </blockquote>
            <figcaption className="mt-3 text-sm text-ink-3">
              @rohan_s · a Murmur post
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 lg:hidden"
            aria-label="Murmur home"
          >
            <span className="grid h-10 w-10 place-items-center rounded-pill bg-accent font-display text-2xl font-bold lowercase text-accent-ink">
              m
            </span>
            <span className="font-display text-2xl font-bold tracking-tight">Murmur</span>
          </Link>

          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-base text-ink-2">{subtitle}</p> : null}

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-8 text-sm text-ink-2">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
