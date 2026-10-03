import { describe, expect, it } from "vitest";
import { can, canAssignRole, hasAtLeast, isRole } from "@/lib/permissions";

describe("permissions (miroir des règles RLS)", () => {
  it("hiérarchie owner > admin > member", () => {
    expect(hasAtLeast("owner", "admin")).toBe(true);
    expect(hasAtLeast("admin", "owner")).toBe(false);
    expect(hasAtLeast("member", "member")).toBe(true);
  });

  it("un member voit l'organisation mais ne gère ni membres ni facturation", () => {
    expect(can("member", "org.view")).toBe(true);
    expect(can("member", "members.invite")).toBe(false);
    expect(can("member", "billing.view")).toBe(false);
    expect(can("member", "audit.view")).toBe(false);
  });

  it("seul l'owner gère la facturation", () => {
    expect(can("admin", "billing.view")).toBe(true);
    expect(can("admin", "billing.manage")).toBe(false);
    expect(can("owner", "billing.manage")).toBe(true);
  });

  it("seul un owner peut attribuer le rôle owner", () => {
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("admin", "member")).toBe(true);
    expect(canAssignRole("member", "member")).toBe(false);
  });

  it("isRole filtre les valeurs inconnues", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("superadmin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
