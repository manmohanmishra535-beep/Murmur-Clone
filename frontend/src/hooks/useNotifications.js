import { useCallback } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  NOTIFICATION_PAGE_SIZE,
  notificationService,
} from "@/services/notificationService";

/** The notification list: the viewer's own rows, newest first. */
export function useNotifications({ enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) =>
      notificationService.list({ cursor: pageParam, limit: NOTIFICATION_PAGE_SIZE }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

/**
 * What the sidebar badge and the bottom bar read. A Socket.IO push moves this
 * number in place, so a new notification never costs a refetch.
 */
export function useUnreadCount({ enabled = true } = {}) {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationService.unreadCount(),
    enabled,
  });
}

/**
 * Opening the notifications screen clears the badge: the API marks every row
 * read, and the cache is cleared with it rather than refetched. If the request
 * fails the list is refetched, so the badge goes back to the truth.
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    queryClient.setQueryData(["notifications"], (current) => {
      if (!current || !Array.isArray(current.pages)) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: (page.items || []).map((item) => (item.read ? item : { ...item, read: true })),
        })),
      };
    });
    queryClient.setQueryData(["notifications", "unread"], 0);

    try {
      await notificationService.markAllRead();
    } catch {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [queryClient]);
}
