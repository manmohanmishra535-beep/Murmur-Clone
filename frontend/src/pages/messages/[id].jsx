import Head from "next/head";
import { useRouter } from "next/router";
import PageHeader from "@/components/PageHeader";
import MessageThread from "@/components/MessageThread";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { MailIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  useConversationMessages,
  useConversations,
  useSendMessage,
} from "@/hooks/useMessages";

export default function ConversationPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, ready } = useRequireAuth();

  // The thread is fetched by id, but the header needs the other participant,
  // and the only place that names them is the inbox. The API reference has no
  // single-conversation endpoint, so the inbox is the source.
  const inbox = useConversations({ enabled: ready });
  const conversation =
    (inbox.data && inbox.data.items
      ? inbox.data.items.find((item) => item._id === id)
      : null) || null;

  const messages = useConversationMessages(id, { enabled: ready && Boolean(id) });
  const send = useSendMessage(id);

  const other = conversation ? conversation.other : null;

  return (
    <>
      <Head>
        <title>{other ? `${other.displayName || other.username} · Messages` : "Messages"} · Murmur</title>
      </Head>

      <PageHeader
        back
        title={other ? other.displayName || other.username : "Conversation"}
        subtitle={other ? `@${other.username}` : undefined}
      />

      {!ready ? null : conversation ? (
        <MessageThread
          conversation={conversation}
          viewerId={user ? user._id : undefined}
          query={messages}
          sending={send.isPending}
          onSend={(text) => send.mutateAsync(text)}
        />
      ) : inbox.isLoading ? (
        <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading conversation">
          <Skeleton className="h-10 w-3/5 rounded-lg" />
          <Skeleton className="ml-auto h-10 w-2/5 rounded-lg" />
        </div>
      ) : (
        <EmptyState
          icon={MailIcon}
          title="This conversation is not available"
          action={
            <button
              type="button"
              onClick={() => router.push("/messages")}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Back to all conversations
            </button>
          }
        >
          It may have been removed, or the link may have been for someone
          else&apos;s chat.
        </EmptyState>
      )}
    </>
  );
}
