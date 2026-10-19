import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import {
  BellIcon,
  HomeIcon,
  MailIcon,
  SearchIcon,
  UserIcon,
} from "./icons";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useNotifications";

/** Below 720px navigation moves to a bottom bar. Tap targets are 44px. */
export default function BottomBar() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useUnreadCount({ enabled: Boolean(user) });

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
    {
      href: user ? `/${user.username}` : "/",
      label: "Profile",
      icon: UserIcon,
      active: user ? router.pathname === `/${user.username}` : false,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-feed items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                className={clsx(
                  "flex h-full items-center justify-center transition-colors duration-fast",
                  item.active ? "text-accent" : "text-ink-3 hover:text-ink"
                )}
              >
                <span className="relative">
                  <Icon size={24} />
                  {item.badge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-accent px-1 font-body text-[10px] font-bold leading-none text-accent-ink"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
