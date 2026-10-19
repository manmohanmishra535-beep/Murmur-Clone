import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import { SearchIcon } from "./icons";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/userService";

/** How many suggestions fit before the rail starts to feel like a page. */
const RAIL_SUGGESTIONS = 3;

/**
 * 340px rail: search, trends and suggested accounts.
 *
 * The suggestions are the real ones, from the same endpoint /explore reads, so
 * the rail is a shortcut rather than a second list that could disagree with it.
 * Trends are not part of the v1 API, so the block says so instead of inventing
 * numbers.
 */
export default function RightRail() {
  const { user } = useAuth();

  const suggested = useQuery({
    queryKey: ["users", "suggested"],
    queryFn: () => userService.suggested(),
    // Suggestions carry isFollowing, so they need a session. A guest would
    // otherwise trip the 401 handler and be sent to the login screen.
    enabled: Boolean(user),
  });

  const people = (suggested.data || []).slice(0, RAIL_SUGGESTIONS);

  return (
    <aside className="hidden w-[340px] shrink-0 py-4 pl-6 lg:block">
      <div className="sticky top-0 flex flex-col gap-4">
        <Link
          href="/explore"
          className="flex h-11 w-full items-center gap-2 rounded-pill border border-line bg-surface-2 px-3 text-left text-base text-ink-3 transition-colors duration-fast hover:border-ink-3 hover:text-ink-2"
        >
          <SearchIcon size={18} />
          <span>Search Murmur</span>
        </Link>

        {user ? (
          <section
            className="rounded-lg border border-line bg-surface p-4"
            aria-labelledby="follow-title"
          >
            <h2 id="follow-title" className="font-display text-lg font-semibold text-ink">
              Who to follow
            </h2>

            {people.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">
                {suggested.isLoading
                  ? "Looking for accounts…"
                  : "Nobody new right now. Search for someone on Explore."}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {people.map((person) => (
                  <li key={person._id} className="flex items-center gap-2">
                    <Link
                      href={`/${person.username}`}
                      className="flex min-w-0 flex-1 items-center gap-2"
                      aria-label={`${person.displayName} (@${person.username})'s profile`}
                    >
                      <Avatar
                        size={32}
                        src={person.profileImage}
                        name={person.displayName}
                        username={person.username}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {person.displayName || person.username}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          @{person.username}
                        </span>
                      </span>
                    </Link>
                    <FollowButton user={person} />
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/explore"
              className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
            >
              Show more
            </Link>
          </section>
        ) : null}

        <section
          className="rounded-lg border border-line bg-surface p-4"
          aria-labelledby="trends-title"
        >
          <h2 id="trends-title" className="font-display text-lg font-semibold text-ink">
            Trends
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Trending topics are not part of the v1 API, so this block stays empty
            on purpose rather than showing numbers nothing backs.
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
