import { useRouter } from "next/router";
import { ArrowLeftIcon } from "./icons";

/** Sticky screen header: optional back control, title, subtitle and an action. */
export default function PageHeader({ title, subtitle, back = false, action }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 py-2">
      {back ? (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-2 transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeftIcon size={20} />
        </button>
      ) : null}

      <div className={back ? "min-w-0" : "min-w-0 px-2"}>
        <h1 className="truncate font-display text-xl font-semibold leading-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-xs text-ink-3">{subtitle}</p>
        ) : null}
      </div>

      {action ? <div className="ml-auto shrink-0 pr-1">{action}</div> : null}
    </header>
  );
}
