/** Couleurs proposées pour personnaliser la page de collectionneur. */
export const PROFILE_ACCENTS = [
  { key: 'jaune', label: 'Jaune', color: '#ffd43b' },
  { key: 'orange', label: 'Orange', color: '#ff922b' },
  { key: 'rouge', label: 'Rouge', color: '#ff6b6b' },
  { key: 'rose', label: 'Rose', color: '#f783ac' },
  { key: 'violet', label: 'Violet', color: '#9775fa' },
  { key: 'bleu', label: 'Bleu', color: '#4dabf7' },
  { key: 'cyan', label: 'Cyan', color: '#3bc9db' },
  { key: 'vert', label: 'Vert', color: '#51cf66' },
] as const;

export const accentColor = (key: string | null | undefined) =>
  (PROFILE_ACCENTS.find((a) => a.key === key) ?? PROFILE_ACCENTS[0]).color;

/** Contact affiché tel quel, ou lien s'il s'agit d'une adresse web. */
export const contactHref = (contact: string) =>
  /^https:\/\/[^\s]+$/i.test(contact) ? contact : null;
