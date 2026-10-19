import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import PostList from "@/components/PostList";
import EmptyState from "@/components/EmptyState";
import { BookmarkIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useBookmarks } from "@/hooks/useFeed";

export default function BookmarksPage() {
  const { user, ready } = useRequireAuth();
  const query = useBookmarks({ enabled: ready });

  return (
    <>
      <Head>
        <title>Bookmarks · Murmur</title>
      </Head>
      <PageHeader title="Bookmarks" subtitle="Only you can see these" />
      {ready ? (
        <PostList
          query={query}
          viewerId={user ? user._id : undefined}
          label="Bookmarks"
          empty={
            <EmptyState icon={BookmarkIcon} title="Nothing saved yet">
              Tap the bookmark icon on a post to keep it here. Bookmarks are
              private and stay until you remove them.
            </EmptyState>
          }
        />
      ) : null}
    </>
  );
}
