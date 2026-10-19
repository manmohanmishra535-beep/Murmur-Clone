import clsx from "clsx";
import { counterTone, ringOffset, RING_CIRCUMFERENCE } from "@/lib/composer";

const TONE_COLOR = {
  normal: "var(--ink-3)",
  warn: "var(--warn)",
  danger: "var(--danger)",
};

/**
 * Ring counter: full at 280 remaining, amber at 20, red below 0.
 * The number is announced politely and is only drawn once it is close to the
 * limit, so the ring stays quiet while a draft has room.
 */
export default function CounterRing({ remaining, id }) {
  const tone = counterTone(remaining);
  const color = TONE_COLOR[tone];
  const showNumber = remaining <= 20;

  return (
    <span className="relative grid h-8 w-8 place-items-center">
      <svg width="32" height="32" viewBox="0 0 24 24" className="-rotate-90" aria-hidden="true">
        <circle cx="12" cy="12" r={9} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r={9}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={ringOffset(remaining)}
          className="transition-[stroke-dashoffset,stroke] duration-base ease-out"
        />
      </svg>
      <span
        aria-hidden="true"
        className={clsx("absolute font-mono text-[10px] font-medium tabular", !showNumber && "sr-only")}
        style={{ color }}
      >
        {showNumber ? remaining : ""}
      </span>
      <span className="sr-only" aria-live="polite">
        {remaining < 0
          ? `${Math.abs(remaining)} characters over the limit`
          : `${remaining} characters remaining`}
      </span>
    </span>
  );
}
