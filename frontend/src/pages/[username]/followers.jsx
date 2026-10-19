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
import { useFollowers } from "@/hooks/useFeed";
import { userService } from "@/services/userService";
import { errorCode } from "@/services/api";

/**
 * /[username]/followers - public, like the profile it belongs to, so a shared
 * link opens for a signed-out visitor. The header tabs switch between the two
 * lists without going back to the profile.
 */
export default function FollowersPage() {
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
  const followers = useFollowers(profile?._id, { enabled: Boolean(profile) });

  if (notFound) {
    return (
      <>
        <Head>
          <title>Account not found · Murmur</title>
        </Head>
        <PageHeader title="Followers" back />
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
        <title>{`Followers of @${username} · Murmur`}</title>
      </Head>

      <PageHeader
        title={profile ? `@${profile.username}` : "Followers"}
        subtitle={`${profile ? profile.followerCount : ""} followers`.trim()}
        back
      />

      {profile ? (
        <Tabs
          label="Follow lists"
          value="followers"
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
          query={followers}
          label={`Followers of @${username}`}
          empty={
            <EmptyState icon={UsersIcon} title="No followers yet">
              When someone follows @{username}, they show up here.
            </EmptyState>
          }
        />
      )}
    </>
  );
}
