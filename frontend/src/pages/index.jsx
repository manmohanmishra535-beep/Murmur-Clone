import { useState } from "react";
import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import Tabs from "@/components/Tabs";
import Composer from "@/components/Composer";
import PostList from "@/components/PostList";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { SearchIcon, UsersIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/hooks/useToast";
import { useExplore, useFeed } from "@/hooks/useFeed";
import { usePostActions } from "@/hooks/usePostActions";
import { errorFields, errorMessage } from "@/services/api";

export default function HomePage() {
  const { user, ready } = useRequireAuth();
  const { toast } = useToast();
  const { createPost } = usePostActions();

  // Following is the default because it is the feed the delivery table asks
  // for: only the accounts you follow, plus yourself, newest first.
  const [tab, setTab] = useState("following");
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState([]);
  const [publishing, setPublishing] = useState(false);

  const feed = useFeed({ enabled: ready && tab === "following" });
  const explore = useExplore({ enabled: ready && tab === "for-you" });

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    try {
      await createPost({ content: draft, images });
      // Clear only on success, so a failed post is never lost.
      setDraft("");
      setImages([]);
      toast("Your post is live.", { variant: "success" });
    } catch (error) {
      const fields = errorFields(error);
      toast(fields.content || fields.image || errorMessage(error, "Could not publish that post."), {
        variant: "error",
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <Head>
        <title>Home · Murmur</title>
      </Head>

      <PageHeader title="Home" />

      <Tabs
        label="Home feed"
        value={tab}
        onChange={setTab}
        items={[
          { key: "for-you", label: "For you" },
          { key: "following", label: "Following" },
        ]}
      />

      {ready && user ? (
        <>
          <Composer
            currentUser={user}
            value={draft}
            onChange={setDraft}
            images={images}
            onImagesChange={setImages}
            onSubmit={publish}
            submitting={publishing}
            onImageError={(message) => toast(message, { variant: "error" })}
          />

          {tab === "for-you" ? (
            <PostList
              query={explore}
              viewerId={user._id}
              label="Everyone's newest posts"
              empty={
                <EmptyState icon={SearchIcon} title="No posts yet">
                  When anyone posts, the newest ones show up here.
                </EmptyState>
              }
            />
          ) : (
            <PostList
              query={feed}
              viewerId={user._id}
              label="Your feed"
              empty={
                <EmptyState icon={UsersIcon} title="Your feed is quiet">
                  Nothing here yet. Write the first post above, and it lands here
                  straight away. Following people adds their posts to this feed.
                </EmptyState>
              }
            />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 rounded-pill" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </>
  );
}
