import type { Metadata } from "next";
import { Card, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/utils";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Inscription" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Card>
        <CardTitle className="mb-6">Inscription</CardTitle>
        <AuthForm mode="signup" next={next ? safeRedirectPath(next) : undefined} />
      </Card>
    </main>
  );
}
