import { useEffect, useState } from "react";
import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { UserRow } from "@/components/UserList";
import Skeleton from "@/components/Skeleton";
import { SearchIcon, UsersIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { userService } from "@/services/userService";
import { errorMessage } from "@/services/api";

const SEARCH_DEBOUNCE_MS = 250;

function RowSkeleton() {
  return (
    <div className="flex gap-3 border-b border-line bg-surface p-4">
      <Skeleton className="h-11 w-11 rounded-pill" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

function UserRows({ users, label }) {
  return (
    <ul aria-label={label}>
      {users.map((user) => (
        <li key={user._id}>
          <UserRow user={user} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Explore: search accounts, and a suggested list to fall back on.
 *
 * The docs describe this screen as "user search and suggested accounts" and the
 * API reference names only the search endpoint, so the suggestions come from
 * GET /api/users/suggested, which answers the accounts with the most followers
 * that the viewer is not already following.
 */
export default function ExplorePage() {
  const { ready } = useRequireAuth();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  // One request per pause, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const searching = debounced.length > 0;

  const search = useQuery({
    queryKey: ["users", "search", debounced],
    queryFn: () => userService.search(debounced),
    enabled: ready && searching,
  });

  const suggested = useQuery({
    queryKey: ["users", "suggested"],
    queryFn: () => userService.suggested(),
    enabled: ready,
  });

  const results = search.data || [];
  const suggestions = suggested.data || [];

  return (
    <>
      <Head>
        <title>Explore · Murmur</title>
      </Head>
      <PageHeader title="Explore" />

      <div className="border-b border-line bg-surface p-4">
        <label htmlFor="explore-search" className="sr-only">
          Search accounts
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
            <SearchIcon size={18} />
          </span>
          <input
            id="explore-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search accounts"
            autoComplete="off"
            className="h-11 w-full rounded-pill border border-line bg-surface-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none"
          />
        </div>
      </div>

      {!ready ? null : searching ? (
        search.isLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : search.isError ? (
          <EmptyState icon={UsersIcon} title="Could not search right now">
            {errorMessage(search.error, "The API did not answer. Try again in a moment.")}
          </EmptyState>
        ) : results.length === 0 ? (
          <EmptyState icon={SearchIcon} title={`No accounts match “${debounced}”`}>
            Try a shorter name, or a few letters of the username.
          </EmptyState>
        ) : (
          <UserRows users={results} label={`Accounts matching ${debounced}`} />
        )
      ) : suggested.isLoading ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : suggested.isError ? (
        <EmptyState icon={UsersIcon} title="Could not load suggestions">
          {errorMessage(suggested.error, "The API did not answer. Try again in a moment.")}
        </EmptyState>
      ) : suggestions.length === 0 ? (
        <EmptyState icon={UsersIcon} title="You follow everyone already">
          There is nobody left to suggest. Search for a name above to find
          someone new.
        </EmptyState>
      ) : (
        <>
          <h2 className="px-4 pt-4 pb-2 font-display text-lg font-semibold text-ink">
            Who to follow
          </h2>
          <UserRows users={suggestions} label="Suggested accounts" />
        </>
      )}
    </>
  );
}
