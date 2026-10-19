import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import ConversationList from "@/components/ConversationList";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useConversations } from "@/hooks/useMessages";

export default function MessagesPage() {
  const { ready } = useRequireAuth();
  const query = useConversations({ enabled: ready });

  return (
    <>
      <Head>
        <title>Messages · Murmur</title>
      </Head>
      <PageHeader title="Messages" />
      {ready ? <ConversationList query={query} /> : null}
    </>
  );
}
