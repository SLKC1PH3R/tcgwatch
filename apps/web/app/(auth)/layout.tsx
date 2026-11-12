import { Sparkles } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <h1 className="text-xl font-semibold">TCGWatch</h1>
          <p className="text-sm text-muted-foreground">Suivi des produits scellés Pokémon TCG</p>
        </div>
        {children}
      </div>
    </main>
  );
}
