import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { BellIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function NotificationsPage() {
  const { ready } = useRequireAuth();

  return (
    <>
      <Head>
        <title>Notifications · Murmur</title>
      </Head>
      <PageHeader title="Notifications" />
      {ready ? (
        <EmptyState icon={BellIcon} title="No notifications yet">
          Likes, comments, reposts and follows will show up here in Phase 4, pushed live
          over Socket.IO. The unread badge already has its home in the sidebar.
        </EmptyState>
      ) : null}
    </>
  );
}
