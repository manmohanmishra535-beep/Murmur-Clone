import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import Avatar from "./Avatar";
import Button from "./Button";
import Textarea from "./Textarea";
import {
  BookmarkIcon,
  HeartIcon,
  MoreIcon,
  ReplyIcon,
  RepostIcon,
  ShareIcon,
} from "./icons";
import { compactNumber, relativeTime } from "@/lib/format";
import { cloudinaryUrl } from "@/lib/images";
import { displayedPost, isOwnPost } from "@/lib/posts";
import { POST_MAX } from "@/lib/composer";

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
  disabled = false,
  href,
}) {
  const className = clsx(
    "-ml-2 flex h-11 min-w-11 items-center gap-1.5 rounded-pill px-2 text-sm tabular transition-colors duration-fast ease-out",
    active ? activeColor : "text-ink-3",
    !active && !disabled && "hover:bg-surface-2 hover:text-ink",
    disabled && "cursor-not-allowed opacity-60"
  );

  const content = (
    <>
      <span className={clsx("grid place-items-center", pop && "animate-like-pop")}>
        <Icon size={18} filled={iconFilled} />
      </span>
      {count != null ? <span>{count > 0 ? compactNumber(count) : ""}</span> : null}
    </>
  );

  // The reply action navigates to the thread, so it is a real link: it can be
  // middle-clicked and opened in a new tab, unlike a button that pushes.
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      title={disabled ? label : undefined}
      className={className}
    >
      {content}
    </button>
  );
}

/** The 1, 2 or 4 image grid, shared by a post and by the original it quotes. */
function MediaGrid({ images, content, author, priority }) {
  if (!images || images.length === 0) return null;

  return (
    <div
      className={clsx(
        "mt-3 grid gap-2 overflow-hidden rounded-lg",
        images.length === 1 ? "grid-cols-1" : "grid-cols-2"
      )}
    >
      {images.map((image, index) => (
        <Image
          key={image.publicId || image.url || index}
          src={cloudinaryUrl(image.url)}
          alt={
            content
              ? `Image ${index + 1} in the post by @${author.username}`
              : `Post image ${index + 1} by @${author.username}`
          }
          width={1200}
          height={675}
          sizes="(max-width: 720px) 100vw, 600px"
          // The first image of a list sits above the fold, so it is the LCP
          // candidate; anything below it stays lazy.
          priority={priority && index === 0}
          className="h-auto w-full rounded-lg border border-line object-cover"
        />
      ))}
    </div>
  );
}

/**
 * 44px avatar column, 16px padding, actions row with reply, repost, like,
 * bookmark and share. Counts use tabular numerals. Like and repost are toggle
 * buttons with aria-pressed and an updated label, and never use the accent
 * colour.
 *
 * A real post reads its state and counts straight from the `post` prop, because
 * the query cache is what the optimistic write updates; only the design-system
 * specimen (`demo`) keeps its own copy, since it has no server.
 *
 * A repost is a post whose `repostOf` points at another one, and it renders as
 * the docs describe: a plain repost is that original with a "Reposted by" line,
 * and a repost that carries a comment of its own shows the comment above the
 * original. Either way the buttons act on the original, because that is the post
 * that has the likes, the replies and the counters.
 */
export default function PostCard({
  post,
  viewerId,
  demo = false,
  priority = false,
  replyHref,
  onLike,
  onRepost,
  onBookmark,
  onShare,
  onReply,
  onEdit,
  onDelete,
  className,
}) {
  // The post whose body and buttons this card shows. A plain repost defers to
  // the original it points at; everything else is itself.
  const shown = demo ? post : displayedPost(post);
  const original = demo ? null : post.repostOf || null;
  const plainRepost = Boolean(original) && shown !== post;

  const [demoLiked, setDemoLiked] = useState(Boolean(shown.likedByMe));
  const [demoLikeCount, setDemoLikeCount] = useState(shown.likeCount || 0);
  const [demoReposted, setDemoReposted] = useState(Boolean(shown.repostedByMe));
  const [demoRepostCount, setDemoRepostCount] = useState(shown.repostCount || 0);
  const [demoBookmarked, setDemoBookmarked] = useState(Boolean(shown.bookmarkedByMe));
  const [pop, setPop] = useState(false);

  const liked = demo ? demoLiked : Boolean(shown.likedByMe);
  const likeCount = demo ? demoLikeCount : shown.likeCount || 0;
  const reposted = demo ? demoReposted : Boolean(shown.repostedByMe);
  const repostCount = demo ? demoRepostCount : shown.repostCount || 0;
  const bookmarked = demo ? demoBookmarked : Boolean(shown.bookmarkedByMe);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(shown.content || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const menuRef = useRef(null);

  // The pop is a one-shot 320ms animation; reset it so the next like replays.
  useEffect(() => {
    if (!pop) return undefined;
    const timer = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(timer);
  }, [pop]);

  // Close the options menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const author = shown.author || {};
  const reposter = post.author || {};
  const images = Array.isArray(shown.images) ? shown.images : [];
  const originalAuthor = original ? original.author || {} : {};
  const originalImages = original && Array.isArray(original.images) ? original.images : [];

  // The menu belongs to whoever wrote the post being shown, which for a plain
  // repost is the original author rather than the person who reposted it.
  const canManage = isOwnPost(shown, viewerId) && Boolean(onEdit || onDelete);
  const remaining = POST_MAX - editValue.trim().length;
  const overLimit = remaining < 0;

  // Replies hang off the post that has the thread. A plain repost is only a
  // pointer at the original, so its reply action goes there.
  const threadHref = replyHref && plainRepost ? `/post/${shown._id}` : replyHref;

  function toggleLike() {
    const next = !liked;
    if (next) setPop(true);

    // The specimen has no server, so it keeps its own optimistic copy. A real
    // post is updated in the cache by the page and re-renders from the prop.
    if (demo) {
      setDemoLiked(next);
      setDemoLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    }
    onLike?.(shown);
  }

  function toggleRepost() {
    if (demo) {
      const next = !demoReposted;
      setDemoReposted(next);
      setDemoRepostCount((count) => Math.max(0, count + (next ? 1 : -1)));
    }
    onRepost?.(shown);
  }

  function toggleBookmark() {
    if (demo) setDemoBookmarked((value) => !value);
    onBookmark?.(shown);
  }

  function startEditing() {
    setEditValue(shown.content || "");
    setEditError("");
    setEditing(true);
    setMenuOpen(false);
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!onEdit) return;

    const next = editValue.trim();
    if (!next) {
      setEditError("Write something to save.");
      return;
    }
    if (next.length > POST_MAX) {
      setEditError(`Keep your post to ${POST_MAX} characters.`);
      return;
    }

    setSavingEdit(true);
    setEditError("");
    try {
      await onEdit(shown._id, next);
      setEditing(false);
    } catch {
      setEditError("Could not save your changes. Try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(shown);
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
      setMenuOpen(false);
    }
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
        {plainRepost ? (
          <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-3">
            <RepostIcon size={14} />
            Reposted by @{reposter.username}
          </p>
        ) : null}

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
            <time dateTime={shown.createdAt} suppressHydrationWarning className="text-sm text-ink-3">
              {relativeTime(shown.createdAt)}
            </time>
            {shown.editedAt ? (
              <span className="text-sm text-ink-3" title={new Date(shown.editedAt).toISOString()}>
                {" "}
                · edited
              </span>
            ) : null}
          </p>

          {canManage ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setConfirmingDelete(false);
                }}
                className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-3 transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
              >
                <MoreIcon size={18} />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  aria-label="Post options"
                  className="absolute right-0 top-11 z-10 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-1"
                >
                  {confirmingDelete ? (
                    <div className="p-3">
                      <p className="text-sm text-ink">Delete this post?</p>
                      <p className="mt-1 text-xs text-ink-3">This cannot be undone.</p>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingDelete(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          loading={deleting}
                          onClick={confirmDelete}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={startEditing}
                        className="block w-full px-4 py-3 text-left text-sm text-ink transition-colors duration-fast hover:bg-surface-2"
                      >
                        Edit post
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setConfirmingDelete(true)}
                        className="block w-full px-4 py-3 text-left text-sm text-danger transition-colors duration-fast hover:bg-surface-2"
                      >
                        Delete post
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <span className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center text-ink-3">
              <MoreIcon size={18} />
            </span>
          )}
        </header>

        {editing ? (
          <form onSubmit={saveEdit} className="mt-2" aria-label="Edit post">
            <Textarea
              id={`edit-${shown._id}`}
              label="Post text"
              rows={3}
              value={editValue}
              onChange={(event) => {
                setEditValue(event.target.value);
                setEditError("");
              }}
              error={editError}
              hint={`${Math.max(0, remaining)} characters remaining`}
              disabled={savingEdit}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={savingEdit} disabled={overLimit}>
                Save
              </Button>
            </div>
          </form>
        ) : shown.content ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed text-ink">
            {shown.content}
          </p>
        ) : null}

        <MediaGrid
          images={images}
          content={shown.content}
          author={author}
          priority={priority}
        />

        {/* A repost may carry a comment of its own; when it does, the original
            is quoted underneath it rather than replacing it. */}
        {original && !plainRepost ? (
          <div className="mt-3 rounded-lg border border-line p-3">
            <p className="text-sm leading-snug">
              <Link
                href={`/${originalAuthor.username || ""}`}
                className="font-semibold text-ink hover:underline"
              >
                {originalAuthor.displayName || originalAuthor.username}
              </Link>{" "}
              <span className="text-ink-3">@{originalAuthor.username}</span>
              <span aria-hidden="true" className="text-ink-3">
                {" "}
                ·{" "}
              </span>
              <time
                dateTime={original.createdAt}
                suppressHydrationWarning
                className="text-ink-3"
              >
                {relativeTime(original.createdAt)}
              </time>
            </p>
            {original.content ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                {original.content}
              </p>
            ) : null}
            <MediaGrid
              images={originalImages}
              content={original.content}
              author={originalAuthor}
              priority={false}
            />
          </div>
        ) : null}

        {!shown.content && images.length === 0 && post.mediaPlaceholder ? (
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
            label={
              demo || threadHref || onReply
                ? `Reply to @${author.username}${
                    shown.commentCount ? `, ${compactNumber(shown.commentCount)} replies` : ""
                  }`
                : "Reply, not available here"
            }
            count={shown.commentCount}
            href={threadHref}
            disabled={!demo && !threadHref && !onReply}
            onClick={() => onReply?.(shown)}
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
            disabled={!demo && !onRepost}
            onClick={toggleRepost}
          />
          <ActionButton
            icon={HeartIcon}
            label={`${liked ? "Unlike" : "Like"}${likeCount ? `, ${compactNumber(likeCount)} likes` : ""}`}
            count={likeCount}
            active={liked}
            activeColor="text-like"
            iconFilled={liked}
            pop={pop}
            pressed={liked}
            disabled={!demo && !onLike}
            onClick={toggleLike}
          />
          <ActionButton
            icon={BookmarkIcon}
            label={bookmarked ? "Remove bookmark" : "Bookmark"}
            active={bookmarked}
            activeColor="text-accent"
            iconFilled={bookmarked}
            pressed={bookmarked}
            disabled={!demo && !onBookmark}
            onClick={toggleBookmark}
          />
          <ActionButton
            icon={ShareIcon}
            label="Share post"
            onClick={() => onShare?.(shown)}
            disabled={!onShare}
          />
        </footer>
      </div>
    </article>
  );
}
