import clsx from "clsx";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

const VARIANTS = {
  success: { icon: CheckIcon, color: "text-accent" },
  error: { icon: AlertIcon, color: "text-danger" },
  info: { icon: InfoIcon, color: "text-ink-2" },
};

/**
 * Bottom centre, 2.2 second dwell, role="status".
 * Loading states also announce politely without stealing focus.
 */
export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const variant = VARIANTS[toast.variant] || VARIANTS.info;
        const Icon = variant.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className="animate-rise pointer-events-auto flex max-w-[min(420px,100%)] items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-base text-ink shadow-2"
          >
            <Icon size={18} className={clsx("shrink-0", variant.color)} />
            <p className="min-w-0 flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-3 transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
