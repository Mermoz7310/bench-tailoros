export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { owner: 3, admin: 2, member: 1 };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

export type Action =
  | "org.view"
  | "org.update"
  | "members.view"
  | "members.invite"
  | "members.manage"
  | "billing.view"
  | "billing.manage"
  | "audit.view";

const MINIMUM_ROLE: Record<Action, Role> = {
  "org.view": "member",
  "org.update": "admin",
  "members.view": "member",
  "members.invite": "admin",
  "members.manage": "admin",
  "billing.view": "admin",
  "billing.manage": "owner",
  "audit.view": "admin",
};

/**
 * Miroir côté application des règles RLS. Sert à afficher/masquer l'interface ;
 * la sécurité réelle est appliquée par la base (RLS + fonctions SQL).
 */
export function can(role: Role, action: Action): boolean {
  return hasAtLeast(role, MINIMUM_ROLE[action]);
}

/** Peut-on attribuer `target` à un membre ? Seul un owner peut nommer/retirer un owner. */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (target === "owner") return actor === "owner";
  return hasAtLeast(actor, "admin");
}
