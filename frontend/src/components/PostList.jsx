import { useCallback } from "react";
import PostCard from "./PostCard";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";
import { ReplyIcon } from "./icons";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { usePostActions } from "@/hooks/usePostActions";
import { useToast } from "@/hooks/useToast";
import { flattenPages } from "@/lib/posts";
import { sharePost } from "@/lib/share";
import { errorMessage } from "@/services/api";

function PostSkeleton() {
  return (
    <div className="flex gap-3 border-b border-line bg-surface p-4">
      <Skeleton className="h-11 w-11 rounded-pill" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Renders an infinite query of posts, wiring the actions that exist in Phase 2
 * (edit, delete, share) and the sentinel that loads the next page 400px before
 * the visitor reaches it. Every list of posts goes through here, so the wiring
 * lives in one place.
 */
export default function PostList({
  query,
  viewerId,
  empty = null,
  label = "Posts",
  className,
}) {
  const { updatePost, deletePost } = usePostActions();
  const { toast } = useToast();

  const posts = flattenPages(query.data);

  const sentinelRef = useInfiniteScroll({
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  });

  const share = useCallback(
    async (post) => {
      const result = await sharePost(post);
      if (result.ok && result.via === "clipboard") {
        toast("Link copied to your clipboard.", { variant: "success" });
      } else if (!result.ok && result.reason === "failed") {
        // Never leave the click with no response at all.
        toast(`Could not share that link. It is ${result.url}`, { variant: "error" });
      }
    },
    [toast]
  );

  if (query.isLoading) {
    return (
      <div className={className} aria-busy="true" aria-label={`Loading ${label.toLowerCase()}`}>
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (query.isError && posts.length === 0) {
    return (
      <div className={className}>
        <EmptyState icon={ReplyIcon} title="Could not load these posts">
          {errorMessage(query.error, "The API did not answer. Try again in a moment.")}
        </EmptyState>
      </div>
    );
  }

  if (posts.length === 0) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={className}>
      <ul aria-label={label}>
        {posts.map((post, index) => (
          <li key={post._id}>
            <PostCard
              post={post}
              viewerId={viewerId}
              priority={index === 0}
              onShare={share}
              onEdit={updatePost}
              onDelete={deletePost}
            />
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {query.isFetchingNextPage ? (
        <div className="flex justify-center p-4" aria-live="polite">
          <span className="h-5 w-5 animate-spin-fast rounded-pill border-2 border-ink-3 border-r-transparent" />
          <span className="sr-only">Loading more posts</span>
        </div>
      ) : null}

      {!query.hasNextPage && posts.length > 0 ? (
        <p className="p-4 text-center text-sm text-ink-3">That is every post for now.</p>
      ) : null}
    </div>
  );
}
