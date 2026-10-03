"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";
import type { ActionState } from "@/lib/errors";

const credentials = z.object({
  email: z.email("Adresse e-mail invalide.").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72),
});

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou mot de passe incorrect." };

  redirect(safeRedirectPath(formData.get("next")?.toString()));
}

const signUpSchema = credentials.extend({
  full_name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
});

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const next = safeRedirectPath(formData.get("next")?.toString());
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: "Inscription impossible. Cette adresse est peut-être déjà utilisée." };
  if (!data.session) return { success: "Compte créé. Confirmez votre adresse via le lien reçu par e-mail." };

  redirect(next);
}
