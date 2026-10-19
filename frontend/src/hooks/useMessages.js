import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { INBOX_LIMIT, MESSAGE_PAGE_SIZE, messageService } from "@/services/messageService";
import { appendMessage, withLastMessage } from "@/lib/messages";
import { errorMessage } from "@/services/api";
import { useToast } from "./useToast";
import { useSocket } from "./useSocket";

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
 * Sending a message. When the socket is up it goes over `message:send`, which is
 * the event the docs define and the fastest path: the server stores it through
 * the same service the REST route uses and pushes `message:new` to both
 * participants. With no socket (a dropped connection, or a first load) it falls
 * back to POST, so the message is never lost to a transport.
 *
 * Either way the response and the push both carry the message, and the cache
 * update de-duplicates by id, so the row is drawn once.
 */
export function useSendMessage(conversationId) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { socket, connected } = useSocket();

  return useMutation({
    mutationFn: (text) => {
      if (!socket || !connected) return messageService.send(conversationId, text);

      return new Promise((resolve, reject) => {
        socket
          .timeout(10000)
          .emit("message:send", { conversationId, text }, (error, response) => {
            if (error) {
              reject(error);
              return;
            }
            if (!response || !response.ok) {
              // The ack carries the API's own error shape, so the toast reads
              // the same as it would over REST.
              const failure = new Error(
                (response && response.error && response.error.message) ||
                  "Could not send that message."
              );
              reject(failure);
              return;
            }
            resolve(response.message);
          });
      });
    },
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
