import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold tracking-tight">Votre SaaS</h1>
      <p className="text-lg text-muted-foreground">
        Gabarit prêt pour la production : comptes, organisations, rôles, facturation et journal d&apos;audit.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/signup">Créer un compte</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Se connecter</Link>
        </Button>
      </div>
    </main>
  );
}
