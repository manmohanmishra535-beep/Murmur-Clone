import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/userService";
import { errorMessage } from "@/services/api";
import { withFollow, withFollowInList } from "@/lib/posts";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

const isProfile = (query) => query.queryKey[0] === "profile";
/** Every cached roster of user rows: suggestions, search, followers, following. */
const isUserList = (query) => query.queryKey[0] === "users";

/**
 * Follow and unfollow with the button flipped on the tap and rolled back if the
 * request fails. Four caches hold the relationship: the profile header, the
 * roster rows, the viewer's own following count, and the home feed, which is
 * exactly the list following is supposed to change.
 */
export function useFollow() {
  const queryClient = useQueryClient();
  const { user: viewer } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState(() => new Set());

  const markPending = useCallback((id, on) => {
    setPending((current) => {
      const next = new Set(current);
      if (on) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  }, []);

  const toggleFollow = useCallback(
    async (user, following) => {
      const id = String(user._id);
      const next = Boolean(following);

      const snapshots = [
        ...queryClient.getQueriesData({ predicate: isProfile }),
        ...queryClient.getQueriesData({ predicate: isUserList }),
      ];

      queryClient.setQueriesData({ predicate: isProfile }, (profile) =>
        profile && String(profile._id) === id ? withFollow(profile, next) : profile
      );

      queryClient.setQueriesData({ predicate: isUserList }, (data) =>
        withFollowInList(data, id, next)
      );

      // The viewer's own header counts the accounts they follow.
      const ownKey = viewer ? ["profile", viewer.username] : null;
      if (ownKey && id !== String(viewer._id)) {
        queryClient.setQueryData(ownKey, (profile) =>
          profile
            ? {
                ...profile,
                followingCount: Math.max(0, (profile.followingCount || 0) + (next ? 1 : -1)),
              }
            : profile
        );
      }

      markPending(id, true);
      try {
        const result = next ? await userService.follow(id) : await userService.unfollow(id);

        // Following changes what belongs in the home feed, so it is refetched.
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        toast(next ? `Following @${user.username}.` : `Unfollowed @${user.username}.`, {
          variant: "success",
        });
        return result;
      } catch (error) {
        for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
        toast(errorMessage(error, "Could not save that follow."), { variant: "error" });
        throw error;
      } finally {
        markPending(id, false);
      }
    },
    [queryClient, toast, viewer, markPending]
  );

  return {
    toggleFollow,
    isPending: useCallback((id) => pending.has(String(id)), [pending]),
  };
}
