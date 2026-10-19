import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postService } from "@/services/postService";
import { errorMessage } from "@/services/api";
import { withoutPost, withLike } from "@/lib/posts";
import { useToast } from "./useToast";

/** Every cached list that holds posts: the feed, Explore and each timeline. */
function isPostList(query) {
  const [first, second] = query.queryKey;
  if (first === "feed") return true;
  if (first !== "posts") return false;
  return second === "explore" || second === "user";
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
 */
export function patchCachedPost(queryClient, postId, updater) {
  mapLists(queryClient, (items) =>
    items.map((post) => (post._id === postId ? updater(post) : post))
  );

  const single = queryClient.getQueryData(["post", postId]);
  if (single !== undefined) queryClient.setQueryData(["post", postId], updater(single));
}

/** The single-post cache, or undefined when the permalink is not open. */
function snapshotPost(queryClient, postId) {
  return queryClient.getQueryData(["post", postId]);
}

/**
 * Every write that changes a post, with the UI updated first and rolled back
 * if the request fails. Repost and bookmark join this hook in Phase 4.
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

  return { createPost, updatePost, deletePost, toggleLike };
}
