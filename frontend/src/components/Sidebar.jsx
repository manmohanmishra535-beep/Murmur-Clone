import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import NavItem from "./NavItem";
import {
  BellIcon,
  BookmarkIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
} from "./icons";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useNotifications";

/**
 * 232px full navigation, 72px icon-only between 720px and 1000px.
 * Labels are hidden with CSS rather than a JS breakpoint, so server and client
 * render the same markup.
 *
 * The unread badge reads the shared count query, which a Socket.IO push moves
 * in place, so a notification lights it up without a refetch.
 */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { data: unreadCount = 0 } = useUnreadCount({ enabled: Boolean(user) });
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const profileActive = user ? router.pathname === `/${user.username}` : false;

  const items = [
    { href: "/", label: "Home", icon: HomeIcon, active: router.pathname === "/" },
    { href: "/explore", label: "Explore", icon: SearchIcon, active: router.pathname === "/explore" },
    {
      href: "/notifications",
      label: "Notifications",
      icon: BellIcon,
      active: router.pathname === "/notifications",
      badge: unreadCount,
    },
    { href: "/messages", label: "Messages", icon: MailIcon, active: router.pathname === "/messages" },
    { href: "/bookmarks", label: "Bookmarks", icon: BookmarkIcon, active: router.pathname === "/bookmarks" },
    {
      href: user ? `/${user.username}` : "/",
      label: "Profile",
      icon: UserIcon,
      active: profileActive,
    },
    { href: "/settings", label: "Settings", icon: SettingsIcon, active: router.pathname === "/settings" },
  ];

  function compose() {
    if (router.pathname === "/") {
      const field = typeof document !== "undefined" ? document.getElementById("composer-input") : null;
      if (field) {
        field.focus();
        field.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
    }
    router.push("/");
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout({ redirectUrl: "/login?signedOut=1" });
      // The query flag survives a full reload, so the login page can confirm
      // the sign-out even if Clerk reloads the document.
      await router.replace("/login?signedOut=1");
    } finally {
      setLoggingOut(false);
      setConfirming(false);
    }
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col justify-between py-4 md:flex lg:w-[232px]">
      <div className="flex min-h-0 flex-col gap-1">
        <Link
          href="/"
          aria-label="Murmur home"
          className="mb-2 flex h-12 items-center justify-center gap-2 px-2 lg:justify-start lg:px-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-accent font-display text-xl font-bold lowercase text-accent-ink">
            m
          </span>
          <span className="hidden font-display text-xl font-bold tracking-tight text-ink lg:inline">
            Murmur
          </span>
        </Link>

        <nav aria-label="Primary" className="flex flex-col gap-1">
          {items.map((item) => (
            <NavItem
              key={item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.active}
              badge={item.badge}
              collapsible
            />
          ))}
        </nav>

        <div className="mt-3 px-1 lg:px-0">
          <button
            type="button"
            onClick={compose}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent px-4 font-display text-base font-semibold text-accent-ink shadow-1 transition-[filter,transform] duration-fast hover:brightness-105 active:scale-[0.99]"
          >
            <PlusIcon size={22} />
            <span className="hidden lg:inline">Post</span>
            <span className="sr-only">Write a post</span>
          </button>
        </div>
      </div>

      {user ? (
        <div className="flex items-center justify-between gap-2 rounded-pill px-1 py-1 hover:bg-surface-2 lg:px-2">
          <Link
            href={`/${user.username}`}
            className="flex min-w-0 items-center gap-2 rounded-pill py-1"
            aria-label={`Your profile, @${user.username}`}
          >
            <Avatar size={32} src={user.profileImage} name={user.displayName} username={user.username} />
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-sm font-semibold text-ink">
                {user.displayName || user.username}
              </span>
              <span className="block truncate text-xs text-ink-3">@{user.username}</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Log out"
            title="Log out"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-3 transition-colors duration-fast hover:bg-surface hover:text-ink"
          >
            <LogoutIcon size={18} />
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Log out of Murmur?"
        description="You will need to sign in again to post, reply or read your messages."
        confirmLabel="Log out"
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirming(false)}
      />
    </aside>
  );
}
