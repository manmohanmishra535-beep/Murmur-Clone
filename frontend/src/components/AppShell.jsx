import { useRouter } from "next/router";
import Sidebar from "./Sidebar";
import RightRail from "./RightRail";
import BottomBar from "./BottomBar";
import { PlusIcon } from "./icons";

/**
 * Three columns from 1000px: 232px navigation, a 600px feed and a 340px rail.
 * Between 720px and 1000px the navigation collapses to icons and the rail
 * disappears. Below 720px the feed is the only column and navigation becomes a
 * bottom bar with a floating post button.
 */
export default function AppShell({ children }) {
  const router = useRouter();

  function compose() {
    if (router.pathname === "/") {
      const field = document.getElementById("composer-input");
      if (field) {
        field.focus();
        field.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
    }
    router.push("/");
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex w-full max-w-shell">
        <Sidebar />

        <main className="min-h-dvh w-full min-w-0 max-w-feed border-line pb-24 md:border-x md:pb-8">
          {children}
        </main>

        <RightRail />
      </div>

      <BottomBar />

      <button
        type="button"
        onClick={compose}
        aria-label="Write a post"
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-pill bg-accent text-accent-ink shadow-2 transition-transform duration-fast active:scale-95 md:hidden"
      >
        <PlusIcon size={26} />
      </button>
    </div>
  );
}
