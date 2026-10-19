import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { INBOX_LIMIT, MESSAGE_PAGE_SIZE, messageService } from "@/services/messageService";
import { appendMessage, withLastMessage } from "@/lib/messages";
import { errorMessage } from "@/services/api";
import { useToast } from "./useToast";

/** The inbox, most recently active first. */
export function useConversations({ enabled = true } = {}) {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => messageService.conversations({ limit: INBOX_LIMIT }),
    enabled,
  });
}

/** One thread, newest first, cursor paginated like every other list. */
export function useConversationMessages(conversationId, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      messageService.messages(conversationId, {
        cursor: pageParam,
        limit: MESSAGE_PAGE_SIZE,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && Boolean(conversationId),
  });
}

/**
 * Opening a chat with someone. The API answers the conversation that already
 * exists between the pair, or creates it, so this is also how a "Message"
 * button navigates without a second request.
 */
export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => messageService.start(userId),
    onSuccess: (conversation) => {
      queryClient.setQueryData(["conversations"], (data) => {
        if (!data || !Array.isArray(data.items)) return data;
        if (data.items.some((item) => item._id === conversation._id)) return data;
        return { ...data, items: [conversation, ...data.items] };
      });
      queryClient.setQueryData(["messages", conversation._id], (data) =>
        data || { pages: [{ items: [], nextCursor: null }], pageParams: [null] }
      );
    },
  });
}

/**
 * Sending over REST. The socket pushes the same message back to both
 * participants, and the cache update de-duplicates by id, so the row is drawn
 * once whichever arrives first.
 */
export function useSendMessage(conversationId) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (text) => messageService.send(conversationId, text),
    onSuccess: (message) => {
      queryClient.setQueryData(["messages", conversationId], (data) =>
        appendMessage(data, message)
      );
      queryClient.setQueryData(["conversations"], (data) => withLastMessage(data, message));
    },
    onError: (error) => {
      toast(errorMessage(error, "Could not send that message."), { variant: "error" });
    },
  });
}
