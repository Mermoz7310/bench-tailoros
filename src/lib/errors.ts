/** Convertit une erreur Supabase/PostgreSQL en message lisible, sans fuite de détails techniques. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  switch (error?.code) {
    case "23505":
      return "Cette valeur existe déjà.";
    case "23514":
      return "Action impossible : elle enfreint une règle (par exemple retirer le dernier propriétaire).";
    case "42501":
      return "Vous n'avez pas les droits pour cette action.";
    case "P0002":
      return "Élément introuvable, invalide ou expiré.";
    case "28000":
      return "Veuillez vous reconnecter.";
    case "22023":
      return "Valeur invalide.";
    default:
      return "Une erreur inattendue est survenue. Réessayez.";
  }
}

export type ActionState = { error?: string; success?: string };
