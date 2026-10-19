import Button from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { canFollow } from "@/lib/posts";

/**
 * Follow or unfollow, as a toggle: aria-pressed carries the state and the
 * label says what the next tap does, so it is never just a colour.
 * Renders nothing for your own account, and nothing when signed out.
 */
export default function FollowButton({ user, size = "sm", className }) {
  const { user: viewer } = useAuth();
  const { toggleFollow, isPending } = useFollow();

  if (!canFollow(user, viewer?._id)) return null;

  const following = Boolean(user.isFollowing);
  const pending = isPending(user._id);

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size={size}
      className={className}
      aria-pressed={following}
      aria-label={
        following
          ? `Unfollow @${user.username}`
          : `Follow @${user.username}`
      }
      loading={pending}
      onClick={() => toggleFollow(user, !following)}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
