'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Copie un texte (lien de partage) dans le presse-papiers. */
export function CopyButton({ text, label = 'Copier le lien' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt('Lien à copier :', text);
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? 'Copié' : label}
    </Button>
  );
}
