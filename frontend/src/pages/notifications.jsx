import { useEffect } from "react";
import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import NotificationList from "@/components/NotificationList";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useMarkAllRead, useNotifications } from "@/hooks/useNotifications";

export default function NotificationsPage() {
  const { ready } = useRequireAuth();
  const query = useNotifications({ enabled: ready });
  const markAllRead = useMarkAllRead();

  // Opening this screen clears the badge, which is what the docs put
  // PATCH /api/notifications/read here for.
  useEffect(() => {
    if (!ready) return;
    markAllRead();
  }, [ready, markAllRead]);

  return (
    <>
      <Head>
        <title>Notifications · Murmur</title>
      </Head>
      <PageHeader title="Notifications" />
      {ready ? <NotificationList query={query} /> : null}
    </>
  );
}
