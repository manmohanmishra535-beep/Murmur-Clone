import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import Tabs from "@/components/Tabs";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { BookmarkIcon, PencilIcon, ReplyIcon, UserIcon } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/userService";
import { errorCode } from "@/services/api";
import { compactNumber, joinedDate } from "@/lib/format";

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { user: viewer } = useAuth();
  const [tab, setTab] = useState("posts");

  const profileQuery = useQuery({
    queryKey: ["profile", username],
    queryFn: () => userService.getProfile(username),
    enabled: typeof username === "string" && username.length > 0,
    retry: false,
  });

  const profile = profileQuery.data;
  const notFound = profileQuery.isError && errorCode(profileQuery.error) === "NOT_FOUND";
  const isOwn = Boolean(profile && viewer && profile._id === viewer._id);

  // A disabled query (router.query.username not ready yet, e.g. during the
  // pre-hydration render) is also "pending" in React Query v5, so this covers
  // both the loading state and the brief moment before the route is resolved.
  if (profileQuery.isPending) {
    return (
      <>
        <Head>
          <title>Profile · Murmur</title>
        </Head>
        <PageHeader title="Profile" back />
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-24 w-24 rounded-pill" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Head>
          <title>Account not found · Murmur</title>
        </Head>
        <PageHeader title="Profile" back />
        <EmptyState
          icon={UserIcon}
          title="This account does not exist"
          action={
            <Link href="/">
              <Button variant="secondary">Back to Home</Button>
            </Link>
          }
        >
          Try another username, or head back to your feed.
        </EmptyState>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Head>
          <title>Profile · Murmur</title>
        </Head>
        <PageHeader title="Profile" back />
        <EmptyState icon={UserIcon} title="Could not load this profile">
          The API did not answer. Check that it is running and try again.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`${profile.displayName} (@${profile.username}) · Murmur`}</title>
      </Head>

      <PageHeader title={profile.displayName} subtitle={`@${profile.username}`} back />

      <section className="border-b border-line bg-surface p-4" aria-label="Profile header">
        <div className="flex items-start justify-between gap-3">
          <Avatar
            size={96}
            src={profile.profileImage}
            name={profile.displayName}
            username={profile.username}
            priority
          />

          {isOwn ? (
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                <PencilIcon size={16} />
                Edit profile
              </Button>
            </Link>
          ) : null}
        </div>

        <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-ink">
          {profile.displayName}
        </h2>
        <p className="text-sm text-ink-3">@{profile.username}</p>

        {profile.bio ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-ink">
            {profile.bio}
          </p>
        ) : null}

        <p className="mt-3 text-sm text-ink-3">{joinedDate(profile.createdAt)}</p>

        <p className="mt-2 flex flex-wrap gap-4 text-sm text-ink-3">
          <span>
            <b className="font-semibold text-ink tabular">
              {compactNumber(profile.followingCount)}
            </b>{" "}
            following
          </span>
          <span>
            <b className="font-semibold text-ink tabular">
              {compactNumber(profile.followerCount)}
            </b>{" "}
            followers
          </span>
        </p>
      </section>

      <Tabs
        label="Profile tabs"
        value={tab}
        onChange={setTab}
        items={[
          { key: "posts", label: "Posts" },
          { key: "replies", label: "Replies" },
          { key: "likes", label: "Likes" },
        ]}
      />

      {tab === "posts" ? (
        <EmptyState icon={UserIcon} title={isOwn ? "Your posts land here" : "No posts yet"}>
          {isOwn
            ? "Posting ships in Phase 2. The composer on Home is already built."
            : `When @${profile.username} posts, it will show up here, newest first.`}
        </EmptyState>
      ) : null}

      {tab === "replies" ? (
        <EmptyState icon={ReplyIcon} title="No replies yet">
          Comments arrive in Phase 2, replies in Phase 3.
        </EmptyState>
      ) : null}

      {tab === "likes" ? (
        <EmptyState icon={BookmarkIcon} title="No liked posts to show">
          Likes are private by default, and the tab fills in with Phase 3.
        </EmptyState>
      ) : null}
    </>
  );
}
