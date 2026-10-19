import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { BookmarkIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function BookmarksPage() {
  const { ready } = useRequireAuth();

  return (
    <>
      <Head>
        <title>Bookmarks · Murmur</title>
      </Head>
      <PageHeader title="Bookmarks" />
      {ready ? (
        <EmptyState icon={BookmarkIcon} title="Nothing saved yet">
          Bookmarks are private and stored on your user document. Saving ships in
          Phase 4; the bookmark action is already in the PostCard.
        </EmptyState>
      ) : null}
    </>
  );
}
