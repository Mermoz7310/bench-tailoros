// @ts-check
// Refuse toute instruction destructive dans les migrations (DROP, TRUNCATE, DELETE, ALTER … DROP…).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findDestructiveSql } from "./rules.mjs";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const violations = files.flatMap((f) => findDestructiveSql(join(dir, f), readFileSync(join(dir, f), "utf8")));

if (violations.length) {
  console.error("✗ Migrations refusées :\n- " + violations.join("\n- "));
  console.error("\nLes migrations doivent être additives. Pour supprimer une colonne : la déprécier, puis la retirer à la main après validation humaine.");
  process.exit(1);
}
console.info(`✓ ${files.length} migration(s) vérifiée(s), aucune instruction destructive.`);
