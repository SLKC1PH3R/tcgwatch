'use client';

/** Liste déroulante d'un formulaire GET, envoyé dès que la valeur change. */
export function AutoSubmitSelect({
  name,
  value,
  options,
  label,
  className,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
