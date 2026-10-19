import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import UserList from "@/components/UserList";
import Tabs from "@/components/Tabs";
import { UserIcon, UsersIcon } from "@/components/icons";
import { useFollowing } from "@/hooks/useFeed";
import { userService } from "@/services/userService";
import { errorCode } from "@/services/api";

/** /[username]/following - the mirror of the followers list. */
export default function FollowingPage() {
  const router = useRouter();
  const { username } = router.query;

  const profileQuery = useQuery({
    queryKey: ["profile", username],
    queryFn: () => userService.getProfile(username),
    enabled: typeof username === "string" && username.length > 0,
    retry: false,
  });

  const profile = profileQuery.data;
  const notFound = profileQuery.isError && errorCode(profileQuery.error) === "NOT_FOUND";
  const following = useFollowing(profile?._id, { enabled: Boolean(profile) });

  if (notFound) {
    return (
      <>
        <Head>
          <title>Account not found · Murmur</title>
        </Head>
        <PageHeader title="Following" back />
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

  return (
    <>
      <Head>
        <title>{`Accounts @${username} follows · Murmur`}</title>
      </Head>

      <PageHeader
        title={profile ? `@${profile.username}` : "Following"}
        subtitle={`${profile ? profile.followingCount : ""} following`.trim()}
        back
      />

      {profile ? (
        <Tabs
          label="Follow lists"
          value="following"
          onChange={(key) => router.push(`/${profile.username}/${key}`)}
          items={[
            { key: "followers", label: "Followers" },
            { key: "following", label: "Following" },
          ]}
        />
      ) : null}

      {profileQuery.isPending ? (
        <div className="p-4" aria-busy="true" aria-label="Loading account">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <UserList
          query={following}
          label={`Accounts @${username} follows`}
          empty={
            <EmptyState icon={UsersIcon} title="Not following anyone yet">
              When @{username} follows someone, they show up here.
            </EmptyState>
          }
        />
      )}
    </>
  );
}
