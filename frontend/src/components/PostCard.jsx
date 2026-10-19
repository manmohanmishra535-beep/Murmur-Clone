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
import { isOwnPost } from "@/lib/posts";
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
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      title={disabled ? label : undefined}
      className={clsx(
        "-ml-2 flex h-11 min-w-11 items-center gap-1.5 rounded-pill px-2 text-sm tabular transition-colors duration-fast ease-out",
        active ? activeColor : "text-ink-3",
        !active && !disabled && "hover:bg-surface-2 hover:text-ink",
        disabled && "cursor-not-allowed opacity-70"
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
 * 44px avatar column, 16px padding, actions row with reply, repost, like,
 * bookmark and share. Counts use tabular numerals. Like and repost are toggle
 * buttons with aria-pressed and an updated label, and never use the accent
 * colour.
 *
 * `demo` keeps the local, optimistic toggles for the design-system specimen.
 * A real post has no like endpoint until Phase 3, so those actions render as
 * disabled with a label that says so rather than pretending to work.
 */
export default function PostCard({
  post,
  viewerId,
  demo = false,
  priority = false,
  onLike,
  onRepost,
  onBookmark,
  onShare,
  onReply,
  onEdit,
  onDelete,
  className,
}) {
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [reposted, setReposted] = useState(Boolean(post.repostedByMe));
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);
  const [bookmarked, setBookmarked] = useState(Boolean(post.bookmarkedByMe));
  const [pop, setPop] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(post.content || "");
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

  const author = post.author || {};
  const images = Array.isArray(post.images) ? post.images : [];
  const canManage = isOwnPost(post, viewerId) && Boolean(onEdit || onDelete);
  const remaining = POST_MAX - editValue.trim().length;
  const overLimit = remaining < 0;

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

  function startEditing() {
    setEditValue(post.content || "");
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
      await onEdit(post._id, next);
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
      await onDelete(post);
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
            {post.editedAt ? (
              <span className="text-sm text-ink-3" title={new Date(post.editedAt).toISOString()}>
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

        {post.repostOf ? (
          <p className="mt-1 text-xs text-ink-3">Reposted by @{author.username}</p>
        ) : null}

        {editing ? (
          <form onSubmit={saveEdit} className="mt-2" aria-label="Edit post">
            <Textarea
              id={`edit-${post._id}`}
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
        ) : post.content ? (
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
              <Image
                key={image.publicId || image.url || index}
                src={cloudinaryUrl(image.url)}
                alt={
                  post.content
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
            label={onReply ? "Reply" : "Reply, available in Phase 3"}
            count={post.commentCount}
            disabled={!onReply}
            onClick={() => onReply?.(post)}
          />
          <ActionButton
            icon={RepostIcon}
            label={
              demo
                ? `${reposted ? "Undo repost" : "Repost"}${
                    repostCount ? `, ${compactNumber(repostCount)} reposts` : ""
                  }`
                : "Repost, available in Phase 4"
            }
            count={repostCount}
            active={reposted}
            activeColor="text-accent"
            pressed={reposted}
            disabled={!demo}
            onClick={toggleRepost}
          />
          <ActionButton
            icon={HeartIcon}
            label={
              demo
                ? `${liked ? "Unlike" : "Like"}${likeCount ? `, ${compactNumber(likeCount)} likes` : ""}`
                : "Like, available in Phase 3"
            }
            count={likeCount}
            active={liked}
            activeColor="text-like"
            iconFilled={liked}
            pop={pop}
            pressed={liked}
            disabled={!demo}
            onClick={toggleLike}
          />
          <ActionButton
            icon={BookmarkIcon}
            label={demo ? (bookmarked ? "Remove bookmark" : "Bookmark") : "Bookmark, available in Phase 4"}
            active={bookmarked}
            activeColor="text-accent"
            iconFilled={bookmarked}
            pressed={bookmarked}
            disabled={!demo}
            onClick={toggleBookmark}
          />
          <ActionButton
            icon={ShareIcon}
            label="Share post"
            onClick={() => onShare?.(post)}
            disabled={!onShare}
          />
        </footer>
      </div>
    </article>
  );
}
