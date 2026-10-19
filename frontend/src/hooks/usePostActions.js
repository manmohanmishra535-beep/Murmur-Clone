import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postService } from "@/services/postService";
import { errorMessage } from "@/services/api";
import { withoutPost, withLike, withRepost, withBookmark } from "@/lib/posts";
import { useToast } from "./useToast";

/** Every cached list that holds posts: the feed, Explore and each timeline. */
function isPostList(query) {
  const [first, second] = query.queryKey;
  if (first === "feed") return true;
  if (first !== "posts") return false;
  return second === "explore" || second === "user" || second === "bookmarks";
}

function mapLists(queryClient, mapper) {
  queryClient.setQueriesData({ predicate: isPostList }, (data) => {
    if (!data || !Array.isArray(data.pages)) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: mapper(page.items || []) })),
    };
  });
}

/** Take a copy of every list so a failed request can put it back. */
function snapshotLists(queryClient) {
  return queryClient.getQueriesData({ predicate: isPostList });
}

function restoreLists(queryClient, snapshots) {
  for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
}

/**
 * Overlays new fields on one post wherever it is cached: in every list, and in
 * the single-post cache the permalink page reads. The cache is the source of
 * truth, so two views of the same post can never drift apart.
 *
 * A plain repost shows the original post's body and buttons, so a change to the
 * original is also written onto the repost's nested copy. Without that, liking a
 * post from the repost that shows it would leave the two views disagreeing.
 */
export function patchCachedPost(queryClient, postId, updater) {
  const patch = (post) => {
    if (!post) return post;
    if (post._id === postId) return updater(post);
    if (post.repostOf && post.repostOf._id === postId) {
      return { ...post, repostOf: updater(post.repostOf) };
    }
    return post;
  };

  mapLists(queryClient, (items) => items.map(patch));

  const single = queryClient.getQueryData(["post", postId]);
  if (single !== undefined) queryClient.setQueryData(["post", postId], patch(single));
}

/** The single-post cache, or undefined when the permalink is not open. */
function snapshotPost(queryClient, postId) {
  return queryClient.getQueryData(["post", postId]);
}

/**
 * Every write that changes a post, with the UI updated first and rolled back if
 * the request fails.
 */
export function usePostActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refreshProfiles = useCallback(() => {
    // postCount and a profile timeline both change when a post is added or removed.
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]);

  const createPost = useCallback(
    async ({ content, images }) => {
      const post = await postService.create({ content, images });

      // Show it immediately at the top of the feed, then let the server confirm.
      queryClient.setQueryData(["feed"], (data) => {
        if (!data || !Array.isArray(data.pages) || data.pages.length === 0) return data;
        const [first, ...rest] = data.pages;
        return {
          ...data,
          pages: [{ ...first, items: [post, ...(first.items || [])] }, ...rest],
        };
      });

      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["posts", "explore"] });
      queryClient.invalidateQueries({ queryKey: ["posts", "user", post.author.username] });
      refreshProfiles();

      return post;
    },
    [queryClient, refreshProfiles]
  );

  const updatePost = useCallback(
    async (id, content) => {
      const updated = await postService.update(id, { content });
      mapLists(queryClient, (items) =>
        items.map((post) => (post._id === id ? updated : post))
      );
      queryClient.setQueryData(["post", id], updated);
      return updated;
    },
    [queryClient]
  );

  const deletePost = useCallback(
    async (post) => {
      const snapshots = snapshotLists(queryClient);
      const single = snapshotPost(queryClient, post._id);

      queryClient.setQueriesData({ predicate: isPostList }, (data) => withoutPost(data, post._id));

      try {
        await postService.remove(post._id);
        queryClient.removeQueries({ queryKey: ["post", post._id] });
        // A deleted post takes its thread with it.
        queryClient.removeQueries({ queryKey: ["comments", post._id] });
        queryClient.invalidateQueries({ queryKey: ["posts", "user", post.author?.username] });
        refreshProfiles();
        toast("Post deleted.", { variant: "success" });
      } catch (error) {
        restoreLists(queryClient, snapshots);
        if (single !== undefined) queryClient.setQueryData(["post", post._id], single);
        toast(errorMessage(error, "Could not delete that post."), { variant: "error" });
        throw error;
      }
    },
    [queryClient, refreshProfiles, toast]
  );

  /**
   * Like and unlike. The heart fills on the tap and the server's count wins
   * when the response lands, because another account may have liked the same
   * post in between. A failure puts the previous state back.
   */
  const toggleLike = useCallback(
    async (post) => {
      const id = post._id;
      const next = !post.likedByMe;
      const snapshots = snapshotLists(queryClient);
      const single = snapshotPost(queryClient, id);

      patchCachedPost(queryClient, id, (item) => withLike(item, next));

      try {
        const result = next ? await postService.like(id) : await postService.unlike(id);
        patchCachedPost(queryClient, id, (item) => ({
          ...item,
          likedByMe: result.liked,
          likeCount: result.likeCount,
        }));
        return result;
      } catch (error) {
        restoreLists(queryClient, snapshots);
        if (single !== undefined) queryClient.setQueryData(["post", id], single);
        toast(errorMessage(error, "Could not save that like."), { variant: "error" });
        throw error;
      }
    },
    [queryClient, toast]
  );

  /**
   * Repost and undo. The repost is a real post, so it also joins the viewer's
   * own timeline and their followers' feeds: those lists are refetched rather
   * than patched, because a repost can appear at the top of a list the viewer is
   * not looking at.
   *
   * The flag and the counter are laid on the original straight away. A repost
   * that already exists answers 200 instead of 201, so a second tap is a no-op
   * rather than a second repost.
   */
  const toggleRepost = useCallback(
    async (post) => {
      const id = post._id;
      const next = !post.repostedByMe;
      const snapshots = snapshotLists(queryClient);
      const single = snapshotPost(queryClient, id);

      patchCachedPost(queryClient, id, (item) => withRepost(item, next));

      try {
        const result = next ? await postService.repost(id) : await postService.unrepost(id);

        // The response carries the original with its authoritative counter.
        if (next && result && result.repostOf) {
          patchCachedPost(queryClient, id, (item) => ({
            ...item,
            repostedByMe: true,
            repostCount: result.repostOf.repostCount,
          }));
        }

        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["posts", "explore"] });
        refreshProfiles();

        if (next) toast("Reposted.", { variant: "success" });
        return result;
      } catch (error) {
        restoreLists(queryClient, snapshots);
        if (single !== undefined) queryClient.setQueryData(["post", id], single);
        toast(errorMessage(error, "Could not repost that."), { variant: "error" });
        throw error;
      }
    },
    [queryClient, refreshProfiles, toast]
  );

  /**
   * Save and unsave, a private toggle with no counter. The bookmarks list is a
   * cache of its own, so it is refetched when it is open; the saved post moves
   * in or out of it without a reload.
   */
  const toggleBookmark = useCallback(
    async (post) => {
      const id = post._id;
      const next = !post.bookmarkedByMe;
      const snapshots = snapshotLists(queryClient);
      const single = snapshotPost(queryClient, id);

      patchCachedPost(queryClient, id, (item) => withBookmark(item, next));

      try {
        const result = next ? await postService.bookmark(id) : await postService.unbookmark(id);
        patchCachedPost(queryClient, id, (item) => withBookmark(item, result.bookmarked));
        queryClient.invalidateQueries({ queryKey: ["posts", "bookmarks"] });

        toast(result.bookmarked ? "Saved to your bookmarks." : "Removed.", {
          variant: "success",
        });
        return result;
      } catch (error) {
        restoreLists(queryClient, snapshots);
        if (single !== undefined) queryClient.setQueryData(["post", id], single);
        toast(errorMessage(error, "Could not save that bookmark."), { variant: "error" });
        throw error;
      }
    },
    [queryClient, toast]
  );

  return { createPost, updatePost, deletePost, toggleLike, toggleRepost, toggleBookmark };
}
