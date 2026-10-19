import { useInfiniteQuery } from "@tanstack/react-query";
import { POST_PAGE_SIZE, postService } from "@/services/postService";
import { USER_PAGE_SIZE, userService } from "@/services/userService";

/**
 * Cursor pagination through TanStack Query. getNextPageParam hands back the
 * API's nextCursor, and null means there is nothing left to load, which is
 * exactly what useInfiniteQuery expects.
 */
function useCursorList({ queryKey, queryFn, enabled = true }) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

/** The home feed: people you follow, plus yourself, newest first. */
export function useFeed({ enabled = true } = {}) {
  return useCursorList({
    queryKey: ["feed"],
    queryFn: (cursor) => postService.feed({ cursor, limit: POST_PAGE_SIZE }),
    enabled,
  });
}

/** Everyone's newest posts, which is the home screen's "For you" tab. */
export function useExplore({ enabled = true } = {}) {
  return useCursorList({
    queryKey: ["posts", "explore"],
    queryFn: (cursor) => postService.explore({ cursor, limit: POST_PAGE_SIZE }),
    enabled,
  });
}

export function useUserPosts(username, { enabled = true } = {}) {
  return useCursorList({
    queryKey: ["posts", "user", username],
    queryFn: (cursor) => postService.byUser({ username, cursor, limit: POST_PAGE_SIZE }),
    enabled: enabled && Boolean(username),
  });
}

/** The members of an account's follower or following list, each with a button. */
export function useFollowers(userId, { enabled = true } = {}) {
  return useCursorList({
    queryKey: ["users", "followers", userId],
    queryFn: (cursor) => userService.followers(userId, { cursor, limit: USER_PAGE_SIZE }),
    enabled: enabled && Boolean(userId),
  });
}

export function useFollowing(userId, { enabled = true } = {}) {
  return useCursorList({
    queryKey: ["users", "following", userId],
    queryFn: (cursor) => userService.following(userId, { cursor, limit: USER_PAGE_SIZE }),
    enabled: enabled && Boolean(userId),
  });
}

/** The comment thread under one post, newest first. */
export function useComments(postId, { enabled = true } = {}) {
  return useCursorList({
    queryKey: ["comments", postId],
    queryFn: (cursor) => postService.comments(postId, { cursor }),
    enabled: enabled && Boolean(postId),
  });
}
