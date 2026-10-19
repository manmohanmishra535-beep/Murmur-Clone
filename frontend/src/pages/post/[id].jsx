import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import PostCard from "@/components/PostCard";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { ReplyIcon } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { usePostActions } from "@/hooks/usePostActions";
import { postService } from "@/services/postService";
import { errorCode } from "@/services/api";

export default function PostPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const { updatePost, deletePost } = usePostActions();
  const [deleted, setDeleted] = useState(false);

  // /post/[id] is public, so this works for a signed-out visitor opening a
  // shared link. isPending covers the render before router.query.id exists.
  const postQuery = useQuery({
    queryKey: ["post", id],
    queryFn: () => postService.get(id),
    enabled: typeof id === "string" && id.length > 0,
    retry: false,
  });

  const post = postQuery.data;
  const notFound = postQuery.isError && errorCode(postQuery.error) === "NOT_FOUND";

  async function share(sharedPost) {
    const url = `${window.location.origin}/post/${sharedPost._id}`;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: `A post by @${sharedPost.author?.username}` });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied to your clipboard.", { variant: "success" });
    } catch {
      // The share sheet was dismissed, or the clipboard is blocked.
    }
  }

  async function remove(removed) {
    await deletePost(removed);
    setDeleted(true);
    router.push("/");
  }

  return (
    <>
      <Head>
        <title>{post ? `${post.author.displayName} on Murmur` : "Post · Murmur"}</title>
      </Head>

      <PageHeader title="Post" back />

      {postQuery.isPending ? (
        <div className="flex gap-3 border-b border-line bg-surface p-4">
          <Skeleton className="h-11 w-11 rounded-pill" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ) : null}

      {notFound || deleted ? (
        <EmptyState
          icon={ReplyIcon}
          title="This post is no longer here"
          action={
            <Link href="/">
              <Button variant="secondary">Back to Home</Button>
            </Link>
          }
        >
          It may have been deleted by its author. The link still works, there is just
          nothing to show.
        </EmptyState>
      ) : null}

      {!notFound && !deleted && post ? (
        <PostCard
          post={post}
          viewerId={user?._id}
          onShare={share}
          onEdit={updatePost}
          onDelete={remove}
        />
      ) : null}

      {!notFound && !deleted && !post && !postQuery.isPending ? (
        <EmptyState icon={ReplyIcon} title="Could not load this post">
          The API did not answer. Check that it is running and try again.
        </EmptyState>
      ) : null}

      {post && !deleted ? (
        <EmptyState icon={ReplyIcon} title="No comments yet">
          The comment thread arrives in Phase 3. The post above is live.
        </EmptyState>
      ) : null}
    </>
  );
}
