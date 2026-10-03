import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Link className="underline" href="/app">
        Retour à l&apos;application
      </Link>
    </main>
  );
}
