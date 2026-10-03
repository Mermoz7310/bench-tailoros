"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Input, Label } from "@/components/ui/input";
import type { ActionState } from "@/lib/errors";
import { signIn, signUp } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(mode === "login" ? signIn : signUp, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name">Nom complet</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{mode === "login" ? "Se connecter" : "Créer mon compte"}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>Pas encore de compte ? <Link className="underline" href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Inscription</Link></>
        ) : (
          <>Déjà inscrit ? <Link className="underline" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Connexion</Link></>
        )}
      </p>
    </form>
  );
}
