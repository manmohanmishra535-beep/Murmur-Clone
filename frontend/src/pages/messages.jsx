import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { MailIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function MessagesPage() {
  const { ready } = useRequireAuth();

  return (
    <>
      <Head>
        <title>Messages · Murmur</title>
      </Head>
      <PageHeader title="Messages" />
      {ready ? (
        <EmptyState icon={MailIcon} title="Direct messages arrive in Phase 4">
          Conversations, typing indicators and live delivery are planned for the advanced
          phase. The HTTP route will accept a request with the same cookie as the rest.
        </EmptyState>
      ) : null}
    </>
  );
}
