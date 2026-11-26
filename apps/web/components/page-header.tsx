/**
 * En-tête de page. Sur une page plein écran (variante `fit`), il se resserre : titre à gauche,
 * description sur une ou deux lignes à droite, sans marge sous lui.
 */
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-2 fit:mb-0 fit:flex-nowrap fit:pt-0">
      <div className="max-w-3xl space-y-2 fit:flex fit:max-w-none fit:min-w-0 fit:flex-1 fit:items-end fit:justify-between fit:gap-6 fit:space-y-0">
        <h1 className="w-fit text-grad font-display text-3xl leading-[1.05] font-black tracking-[-0.035em] md:text-[2.75rem] fit:shrink-0 fit:text-[2.1rem]">
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base fit:line-clamp-2 fit:max-w-xl fit:text-right fit:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 fit:shrink-0 fit:flex-nowrap">{actions}</div>
      )}
    </div>
  );
}
