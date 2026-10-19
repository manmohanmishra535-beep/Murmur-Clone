import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postService } from "@/services/postService";
import { errorMessage } from "@/services/api";
import { useToast } from "./useToast";

/** Every cached list that holds posts: the feed and each profile timeline. */
function isPostList(query) {
  const [first, second] = query.queryKey;
  return first === "feed" || (first === "posts" && second === "user");
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
 * Create, edit and delete with the UI updated first and rolled back if the
 * request fails (like, repost and bookmark join this hook in Phase 3/4).
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
      mapLists(queryClient, (items) => items.filter((item) => item._id !== post._id));

      try {
        await postService.remove(post._id);
        queryClient.removeQueries({ queryKey: ["post", post._id] });
        queryClient.invalidateQueries({ queryKey: ["posts", "user", post.author?.username] });
        refreshProfiles();
        toast("Post deleted.", { variant: "success" });
      } catch (error) {
        restoreLists(queryClient, snapshots);
        toast(errorMessage(error, "Could not delete that post."), { variant: "error" });
        throw error;
      }
    },
    [queryClient, refreshProfiles, toast]
  );

  return { createPost, updatePost, deletePost };
}
