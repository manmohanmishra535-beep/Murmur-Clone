import { useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import Button from "./Button";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";
import { ReplyIcon } from "./icons";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { flattenPages, isOwnPost } from "@/lib/posts";
import { relativeTime } from "@/lib/format";

/** One reply: 44px avatar column, the same rhythm as a post. */
function CommentRow({ comment, viewerId, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const author = comment.author || {};
  const own = isOwnPost(comment, viewerId);

  async function remove() {
    setDeleting(true);
    try {
      await onDelete(comment);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <article className="grid grid-cols-[44px_1fr] gap-3 border-b border-line bg-surface p-4 transition-colors duration-fast ease-out hover:bg-surface-2">
      <Link
        href={`/${author.username || ""}`}
        aria-label={`${author.displayName || author.username}'s profile`}
      >
        <Avatar size={44} src={author.profileImage} name={author.displayName} username={author.username} />
      </Link>

      <div className="min-w-0">
        <header className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-base leading-snug">
            <Link href={`/${author.username || ""}`} className="font-semibold text-ink hover:underline">
              {author.displayName || author.username}
            </Link>{" "}
            <span className="text-sm text-ink-3">@{author.username}</span>
            <span aria-hidden="true" className="text-sm text-ink-3">
              {" "}
              ·{" "}
            </span>
            <time dateTime={comment.createdAt} suppressHydrationWarning className="text-sm text-ink-3">
              {relativeTime(comment.createdAt)}
            </time>
          </p>

          {own ? (
            confirming ? (
              <span className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button variant="danger" size="sm" loading={deleting} onClick={remove}>
                  Delete
                </Button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="-mr-2 -mt-1 shrink-0 rounded-pill px-2 py-1 text-xs text-ink-3 transition-colors duration-fast hover:bg-surface-2 hover:text-danger"
              >
                Delete reply
              </button>
            )
          ) : null}
        </header>

        <p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed text-ink">
          {comment.content}
        </p>
      </div>
    </article>
  );
}

/**
 * The reply thread under a post, newest first. `onDelete` gets the reply and
 * resolves when the server has removed it; a rejection puts the row back.
 */
export default function CommentList({
  query,
  postId,
  viewerId,
  onDelete,
  empty = null,
  label = "Replies",
  className,
}) {
  const comments = flattenPages(query.data);

  const sentinelRef = useInfiniteScroll({
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  });

  // A rejected delete rolls the cached list back, so the row simply reappears.
  const deleteComment = (comment) => onDelete(comment);

  if (query.isLoading) {
    return (
      <div className={className} aria-busy="true" aria-label="Loading replies">
        <div className="flex gap-3 border-b border-line bg-surface p-4">
          <Skeleton className="h-11 w-11 rounded-pill" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (query.isError && comments.length === 0) {
    return (
      <div className={className}>
        <EmptyState icon={ReplyIcon} title="Could not load the replies">
          The API did not answer. Try again in a moment.
        </EmptyState>
      </div>
    );
  }

  if (comments.length === 0) return <div className={className}>{empty}</div>;

  return (
    <div className={className}>
      <ul aria-label={label}>
        {comments.map((comment) => (
          <li key={comment._id}>
            <CommentRow
              comment={comment}
              viewerId={viewerId}
              onDelete={deleteComment}
            />
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {query.isFetchingNextPage ? (
        <div className="flex justify-center p-4" aria-live="polite">
          <span className="h-5 w-5 animate-spin-fast rounded-pill border-2 border-ink-3 border-r-transparent" />
          <span className="sr-only">Loading more replies</span>
        </div>
      ) : null}
    </div>
  );
}
