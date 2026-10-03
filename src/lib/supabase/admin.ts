import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Client service_role : CONTOURNE la RLS. Réservé aux webhooks et tâches système.
 * Ne jamais l'utiliser pour une action déclenchée par un utilisateur sans vérifier ses droits avant.
 */
export function createAdminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
