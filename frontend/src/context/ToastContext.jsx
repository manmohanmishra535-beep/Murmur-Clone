import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ToastViewport from "@/components/Toast";

export const ToastContext = createContext(null);

const DWELL_MS = 2200;
const MAX_VISIBLE = 3;

/** Bottom-centre toasts, 2.2 seconds, announced with role="status". */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message, options = {}) => {
      const id = nextId.current + 1;
      nextId.current = id;

      setToasts((current) => {
        // Keep the newest three so a burst never covers the composer.
        const next = [...current, { id, message, variant: options.variant || "info" }];
        return next.slice(-MAX_VISIBLE);
      });

      const timer = setTimeout(() => dismiss(id), options.duration || DWELL_MS);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  // Clear every pending timer on unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
