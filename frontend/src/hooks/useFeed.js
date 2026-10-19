import { useInfiniteQuery } from "@tanstack/react-query";
import { POST_PAGE_SIZE, postService } from "@/services/postService";

/**
 * Cursor pagination through TanStack Query. getNextPageParam hands back the
 * API's nextCursor, and null means there is nothing left to load, which is
 * exactly what useInfiniteQuery expects.
 */
export function useFeed({ enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => postService.feed({ cursor: pageParam, limit: POST_PAGE_SIZE }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useUserPosts(username, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: ["posts", "user", username],
    queryFn: ({ pageParam }) =>
      postService.byUser({ username, cursor: pageParam, limit: POST_PAGE_SIZE }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && Boolean(username),
  });
}

/** Infinite query pages are flattened by hand; every list does it the same way. */
export function flattenPages(data) {
  if (!data || !Array.isArray(data.pages)) return [];
  return data.pages.flatMap((page) => page.items || []);
}

export function countPages(data) {
  return flattenPages(data).length;
}
