import { useEffect, useRef } from "react";

/**
 * Fetches the next page when the sentinel nears the viewport. The docs ask for
 * the next page to load 400px before the sentinel is visible, so rootMargin
 * does the prefetching and the visitor rarely sees a spinner.
 *
 * Returns the ref to attach to an element placed after the list.
 */
export function useInfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  rootMargin = "400px",
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return undefined;
    // JSDOM (and any non-browser render) has no IntersectionObserver.
    if (typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, rootMargin]);

  return sentinelRef;
}
