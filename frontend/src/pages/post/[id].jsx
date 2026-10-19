import { useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import PostCard from "@/components/PostCard";
import CommentForm from "@/components/CommentForm";
import CommentList from "@/components/CommentList";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { ReplyIcon } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useComments } from "@/hooks/useFeed";
import { useCommentActions } from "@/hooks/useCommentActions";
import { usePostActions } from "@/hooks/usePostActions";
import { postService } from "@/services/postService";
import { errorFields, errorCode, errorMessage } from "@/services/api";
import { sharePost } from "@/lib/share";

export default function PostPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const { updatePost, deletePost, toggleLike } = usePostActions();
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
  const live = Boolean(post) && !deleted;

  // The thread is readable signed out, but only a signed-in visitor can reply.
  const comments = useComments(id, { enabled: live });
  const { addComment, deleteComment } = useCommentActions(id);
  const replyBox = useRef(null);

  async function share(sharedPost) {
    const result = await sharePost(sharedPost);
    if (result.ok && result.via === "clipboard") {
      toast("Link copied to your clipboard.", { variant: "success" });
    } else if (!result.ok && result.reason === "failed") {
      toast(`Could not share that link. It is ${result.url}`, { variant: "error" });
    }
  }

  async function reply(content) {
    try {
      await addComment(content);
      toast("Your reply is live.", { variant: "success" });
    } catch (error) {
      const fields = errorFields(error);
      toast(fields.content || errorMessage(error, "Could not post your reply."), {
        variant: "error",
      });
      throw error;
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

      {live ? (
        <>
          <PostCard
            post={post}
            viewerId={user?._id}
            priority
            onLike={toggleLike}
            onReply={() => replyBox.current?.focus()}
            onShare={share}
            onEdit={updatePost}
            onDelete={remove}
          />

          {user ? (
            <CommentForm ref={replyBox} currentUser={user} onSubmit={reply} />
          ) : (
            <p className="border-b border-line bg-surface p-4 text-sm text-ink-2">
              <Link href="/login" className="font-semibold text-accent hover:underline">
                Log in
              </Link>{" "}
              to reply to this post.
            </p>
          )}

          <CommentList
            query={comments}
            postId={id}
            viewerId={user?._id}
            onDelete={deleteComment}
            label="Replies"
            empty={
              <EmptyState icon={ReplyIcon} title="No replies yet">
                Be the first to reply to @{post.author.username}.
              </EmptyState>
            }
          />
        </>
      ) : null}

      {!notFound && !deleted && !post && !postQuery.isPending ? (
        <EmptyState icon={ReplyIcon} title="Could not load this post">
          The API did not answer. Check that it is running and try again.
        </EmptyState>
      ) : null}
    </>
  );
}
