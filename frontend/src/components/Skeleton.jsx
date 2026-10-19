import clsx from "clsx";

/** Neutral loading block; stands in for text and media while data arrives. */
export default function Skeleton({ className }) {
  return (
    <span
      aria-hidden="true"
      className={clsx("block animate-pulse rounded-md bg-surface-2", className)}
    />
  );
}
