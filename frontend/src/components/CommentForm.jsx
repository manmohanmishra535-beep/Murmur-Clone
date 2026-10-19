import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import clsx from "clsx";
import Avatar from "./Avatar";
import Button from "./Button";
import CounterRing from "./CounterRing";
import { isPostable, remainingCharacters } from "@/lib/composer";

/**
 * The reply box under a post. Local state is fine here: unlike the composer,
 * nothing above it needs to survive a failed submit.
 *
 * `ref.focus()` lets the post's reply action put the caret in the box, so the
 * reply button does something visible instead of jumping the page around.
 */
const CommentForm = forwardRef(function CommentForm(
  { currentUser, onSubmit, placeholder = "Post your reply", id = "comment-input", className },
  ref
) {
  const textareaRef = useRef(null);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

  const remaining = remainingCharacters(value);
  const canSend = isPostable(value, 0) && !sending;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) return;

    setSending(true);
    setError("");
    try {
      await onSubmit(value.trim());
      setValue("");
    } catch (failure) {
      setError("Could not post your reply. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Write a reply"
      className={clsx("grid grid-cols-[44px_1fr] gap-3 border-b border-line bg-surface p-4", className)}
    >
      <Avatar
        size={44}
        src={currentUser?.profileImage}
        name={currentUser?.displayName}
        username={currentUser?.username}
      />

      <div className="min-w-0">
        <label htmlFor={id} className="sr-only">
          Reply text
        </label>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          rows={2}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          placeholder={placeholder}
          disabled={sending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full resize-none overflow-y-auto bg-transparent text-base leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none disabled:cursor-not-allowed"
        />

        {error ? (
          <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-end gap-3">
          <CounterRing remaining={remaining} />
          <Button type="submit" size="sm" disabled={!canSend} aria-label="Reply">
            {sending ? "Replying…" : "Reply"}
          </Button>
        </div>
      </div>
    </form>
  );
});

export default CommentForm;
