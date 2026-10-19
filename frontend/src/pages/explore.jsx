import Head from "next/head";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { SearchIcon } from "@/components/icons";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function ExplorePage() {
  const { ready } = useRequireAuth();

  return (
    <>
      <Head>
        <title>Explore · Murmur</title>
      </Head>
      <PageHeader title="Explore" />
      {ready ? (
        <EmptyState icon={SearchIcon} title="Search arrives in Phase 4">
          User search, suggested accounts and trending topics all live here. The API
          already has a text index ready for it.
        </EmptyState>
      ) : null}
    </>
  );
}
