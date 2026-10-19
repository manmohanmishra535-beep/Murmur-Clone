export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon ? (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-pill bg-surface-2 text-ink-3">
          <Icon size={24} />
        </span>
      ) : null}
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {children ? <div className="mt-2 max-w-sm text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
