import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postService } from "@/services/postService";
import { errorMessage } from "@/services/api";
import { withoutComment, withCommentCount } from "@/lib/posts";
import { patchCachedPost } from "./usePostActions";
import { useToast } from "./useToast";

/**
 * Adding and removing a reply. The thread is the source of truth for the list,
 * and the reply count on the post itself is moved in the same pass so the
 * action row under the post agrees without a refetch.
 */
export function useCommentActions(postId) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const moveCount = useCallback(
    (delta) => {
      if (!postId) return;
      patchCachedPost(queryClient, postId, (post) => withCommentCount(post, delta));
    },
    [postId, queryClient]
  );

  const addComment = useCallback(
    async (content) => {
      const comment = await postService.addComment(postId, content);

      // Newest first, matching the order the API serves.
      queryClient.setQueryData(["comments", postId], (data) => {
        if (!data || !Array.isArray(data.pages) || data.pages.length === 0) return data;
        const [first, ...rest] = data.pages;
        return {
          ...data,
          pages: [{ ...first, items: [comment, ...(first.items || [])] }, ...rest],
        };
      });

      moveCount(1);
      return comment;
    },
    [postId, queryClient, moveCount]
  );

  const deleteComment = useCallback(
    async (comment) => {
      const snapshot = queryClient.getQueryData(["comments", postId]);
      queryClient.setQueryData(["comments", postId], (data) => withoutComment(data, comment._id));

      try {
        await postService.removeComment(comment._id);
        moveCount(-1);
        toast("Reply deleted.", { variant: "success" });
      } catch (error) {
        queryClient.setQueryData(["comments", postId], snapshot);
        toast(errorMessage(error, "Could not delete that reply."), { variant: "error" });
        throw error;
      }
    },
    [postId, queryClient, moveCount, toast]
  );

  return { addComment, deleteComment };
}
