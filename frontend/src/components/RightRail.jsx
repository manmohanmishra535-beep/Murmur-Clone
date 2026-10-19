import Link from "next/link";
import { SearchIcon } from "./icons";
import { useToast } from "@/hooks/useToast";

/** 340px rail: search, trends and suggested accounts. Content fills in later phases. */
export default function RightRail() {
  const { toast } = useToast();

  return (
    <aside className="hidden w-[340px] shrink-0 py-4 pl-6 lg:block">
      <div className="sticky top-0 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => toast("Search arrives with Explore in Phase 4.", { variant: "info" })}
          className="flex h-11 w-full items-center gap-2 rounded-pill border border-line bg-surface-2 px-3 text-left text-base text-ink-3 transition-colors duration-fast hover:border-ink-3 hover:text-ink-2"
        >
          <SearchIcon size={18} />
          <span>Search Murmur</span>
        </button>

        <section className="rounded-lg border border-line bg-surface p-4" aria-labelledby="trends-title">
          <h2 id="trends-title" className="font-display text-lg font-semibold text-ink">
            Trends
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Trending topics arrive with Explore in Phase 4.
          </p>
        </section>

        <section
          className="rounded-lg border border-line bg-surface p-4"
          aria-labelledby="follow-title"
        >
          <h2 id="follow-title" className="font-display text-lg font-semibold text-ink">
            Who to follow
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Suggestions appear once following ships in Phase 3.
          </p>
        </section>

        <footer className="px-1 text-xs leading-relaxed text-ink-3">
          <Link href="/design" className="hover:text-accent hover:underline">
            Murmur design system
          </Link>
          <span aria-hidden="true"> · </span>
          <span>v1.0</span>
        </footer>
      </div>
    </aside>
  );
}
