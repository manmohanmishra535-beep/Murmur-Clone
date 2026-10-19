import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import Avatar from "./Avatar";
import {
  BookmarkIcon,
  HeartIcon,
  MoreIcon,
  ReplyIcon,
  RepostIcon,
  ShareIcon,
} from "./icons";
import { compactNumber, relativeTime } from "@/lib/format";

function ActionButton({
  icon: Icon,
  label,
  count,
  active,
  activeColor,
  iconFilled,
  pop = false,
  onClick,
  pressed,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      className={clsx(
        "-ml-2 flex h-11 min-w-11 items-center gap-1.5 rounded-pill px-2 text-sm tabular transition-colors duration-fast ease-out",
        active ? activeColor : "text-ink-3",
        !active && "hover:bg-surface-2 hover:text-ink"
      )}
    >
      <span className={clsx("grid place-items-center", pop && "animate-like-pop")}>
        <Icon size={18} filled={iconFilled} />
      </span>
      {count != null ? <span>{count > 0 ? compactNumber(count) : ""}</span> : null}
    </button>
  );
}

/**
 * 44px avatar column, 16px padding, actions row with reply, repost, like and
 * share. Counts use tabular numerals. Like and repost are toggle buttons with
 * aria-pressed and an updated label, and never use the accent colour.
 */
export default function PostCard({
  post,
  onLike,
  onRepost,
  onBookmark,
  onShare,
  onReply,
  className,
}) {
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [reposted, setReposted] = useState(Boolean(post.repostedByMe));
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);
  const [bookmarked, setBookmarked] = useState(Boolean(post.bookmarkedByMe));
  const [pop, setPop] = useState(false);

  // The pop is a one-shot 320ms animation; reset it so the next like replays.
  useEffect(() => {
    if (!pop) return undefined;
    const timer = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(timer);
  }, [pop]);

  const author = post.author || {};
  const images = Array.isArray(post.images) ? post.images : [];
  const href = post._id ? `/post/${post._id}` : undefined;

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    if (next) setPop(true);
    onLike?.(next, post);
  }

  function toggleRepost() {
    const next = !reposted;
    setReposted(next);
    setRepostCount((count) => Math.max(0, count + (next ? 1 : -1)));
    onRepost?.(next, post);
  }

  function toggleBookmark() {
    setBookmarked((value) => !value);
    onBookmark?.(!bookmarked, post);
  }

  return (
    <article
      className={clsx(
        "grid grid-cols-[44px_1fr] gap-3 border-b border-line bg-surface p-4 transition-colors duration-fast ease-out hover:bg-surface-2",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <Link href={`/${author.username || ""}`} aria-label={`${author.displayName || author.username}'s profile`}>
          <Avatar size={44} src={author.profileImage} name={author.displayName} username={author.username} />
        </Link>
      </div>

      <div className="min-w-0">
        <header className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-base leading-snug">
            <Link
              href={`/${author.username || ""}`}
              className="font-semibold text-ink hover:underline"
            >
              {author.displayName || author.username}
            </Link>{" "}
            <span className="text-sm text-ink-3">@{author.username}</span>
            <span aria-hidden="true" className="text-sm text-ink-3">
              {" "}
              ·{" "}
            </span>
            {/* Relative time genuinely differs between the server render and the
                client (elapsed time keeps moving), so let the client value win
                instead of warning about it. */}
            <time dateTime={post.createdAt} suppressHydrationWarning className="text-sm text-ink-3">
              {relativeTime(post.createdAt)}
            </time>
          </p>

          <button
            type="button"
            aria-label="More options"
            className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-3 transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
          >
            <MoreIcon size={18} />
          </button>
        </header>

        {post.repostOf ? (
          <p className="mt-1 text-xs text-ink-3">
            Reposted by @{author.username}
          </p>
        ) : null}

        {post.content ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed text-ink">
            {post.content}
          </p>
        ) : null}

        {images.length > 0 ? (
          <div
            className={clsx(
              "mt-3 grid gap-2 overflow-hidden rounded-lg",
              images.length === 1 ? "grid-cols-1" : "grid-cols-2"
            )}
          >
            {images.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.publicId || image.url || index}
                src={image.url}
                alt=""
                className="max-h-96 w-full rounded-lg border border-line object-cover"
              />
            ))}
          </div>
        ) : post.mediaPlaceholder ? (
          <div
            aria-hidden="true"
            className="mt-3 grid aspect-video w-full place-items-center rounded-lg border border-line bg-surface-2 text-xs text-ink-3"
          >
            16:9 media slot · 18px radius
          </div>
        ) : null}

        <footer className="mt-2 flex max-w-md items-center justify-between">
          <ActionButton
            icon={ReplyIcon}
            label={onReply ? "Reply" : "Reply (comments arrive in Phase 2)"}
            count={post.commentCount}
            onClick={() => onReply?.(post)}
          />
          <ActionButton
            icon={RepostIcon}
            label={`${reposted ? "Undo repost" : "Repost"}${
              repostCount ? `, ${compactNumber(repostCount)} reposts` : ""
            }`}
            count={repostCount}
            active={reposted}
            activeColor="text-accent"
            pressed={reposted}
            onClick={toggleRepost}
          />
          <ActionButton
            icon={HeartIcon}
            label={`${liked ? "Unlike" : "Like"}${
              likeCount ? `, ${compactNumber(likeCount)} likes` : ""
            }`}
            count={likeCount}
            active={liked}
            activeColor="text-like"
            iconFilled={liked}
            pop={pop}
            pressed={liked}
            onClick={toggleLike}
          />
          <ActionButton
            icon={BookmarkIcon}
            label={bookmarked ? "Remove bookmark" : "Bookmark"}
            active={bookmarked}
            activeColor="text-accent"
            iconFilled={bookmarked}
            pressed={bookmarked}
            onClick={toggleBookmark}
          />
          <ActionButton icon={ShareIcon} label="Share post" onClick={() => onShare?.(post)} />
        </footer>
      </div>
    </article>
  );
}
