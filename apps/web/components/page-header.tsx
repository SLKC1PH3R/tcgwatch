export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-2">
      <div className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
