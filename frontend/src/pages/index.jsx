import { useState } from "react";
import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import Tabs from "@/components/Tabs";
import Composer from "@/components/Composer";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { HomeIcon, UsersIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/hooks/useToast";

export default function HomePage() {
  const { user, ready } = useRequireAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("for-you");
  const [draft, setDraft] = useState("");

  function publish() {
    // Phase 2 swaps this for postService.create({ content, images }).
    toast("Draft kept. Publishing arrives with Phase 2.", { variant: "info" });
  }

  return (
    <>
      <Head>
        <title>Home · Murmur</title>
      </Head>

      <PageHeader title="Home" />

      <Tabs
        label="Home feed"
        value={tab}
        onChange={setTab}
        items={[
          { key: "for-you", label: "For you" },
          { key: "following", label: "Following" },
        ]}
      />

      {ready && user ? (
        <>
          <Composer
            currentUser={user}
            value={draft}
            onChange={setDraft}
            onSubmit={publish}
            allowImages={false}
          />

          {tab === "for-you" ? (
            <EmptyState icon={HomeIcon} title="Your feed is quiet">
              Posts from people you follow, plus your own, land here in Phase 3. The
              composer above is already wired to the design system.
            </EmptyState>
          ) : (
            <EmptyState icon={UsersIcon} title="Nothing from people you follow">
              Following arrives in Phase 3. Once it does, this tab shows only their posts,
              newest first.
            </EmptyState>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 rounded-pill" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </>
  );
}
