// @ts-check
/**
 * Règles anti-triche et anti-destruction de l'usine. Fonctions pures, testées dans tests/unit/guards.test.ts.
 * Ce fichier est protégé : un agent (branche task/*) ne peut pas le modifier.
 */

/** Chemins qu'un agent n'a jamais le droit de modifier. */
export const AGENT_PROTECTED = [
  /^tests\/acceptance\//,
  /^tests\/db\/supabase-shim\.sql$/,
  /^\.github\//,
  /^scripts\/ci\//,
  /^FACTORY\.md$/,
  /^playwright\.config\.ts$/,
  /^vitest\.config\.ts$/,
  /^eslint\.config\.mjs$/,
  /^tsconfig\.json$/,
  /^supabase\/config\.toml$/,
];

const MIGRATION_PATH = /^supabase\/migrations\/[^/]+\.sql$/;
const MIGRATION_NAME = /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mjs|js)$/;
const FOCUS_OR_SKIP = /\b(?:it|test|describe)\s*\.\s*(?:only|skip|todo|fixme)\s*\(|\bx(?:it|describe)\s*\(/;

/**
 * @typedef {{ status: string, path: string, oldPath?: string }} Change
 * @typedef {{ path: string, line: string }} AddedLine
 */

/**
 * @param {Change[]} changes  Fichiers modifiés par rapport à la branche de base (git diff --name-status).
 * @param {AddedLine[]} addedLines  Lignes ajoutées dans les fichiers de test.
 * @param {{ agent: boolean }} options
 * @returns {string[]} violations (vide = OK)
 */
export function evaluateChanges(changes, addedLines, options) {
  /** @type {string[]} */
  const violations = [];

  for (const c of changes) {
    const kind = c.status.charAt(0);
    const paths = [c.path, c.oldPath].filter((p) => typeof p === "string");

    if (paths.some((p) => MIGRATION_PATH.test(p)) && kind !== "A") {
      violations.push(`Migration existante modifiée ou supprimée (${c.status} ${c.path}) : créez une nouvelle migration.`);
    }
    if (kind === "A" && MIGRATION_PATH.test(c.path) && !MIGRATION_NAME.test(c.path)) {
      violations.push(`Nom de migration invalide : ${c.path} (attendu : AAAAMMJJHHMMSS_description.sql).`);
    }
    if (options.agent) {
      for (const p of paths) {
        if (AGENT_PROTECTED.some((re) => re.test(p))) violations.push(`Fichier protégé modifié par un agent : ${p}`);
      }
    }
  }

  for (const { path, line } of addedLines) {
    if (TEST_FILE.test(path) && FOCUS_OR_SKIP.test(line)) {
      violations.push(`Test désactivé ou isolé (.only/.skip/.todo/.fixme) dans ${path} : ${line.trim()}`);
    }
  }
  return violations;
}

const DESTRUCTIVE = [
  { re: /\bdrop\s+(?:table|schema|column|view|materialized\s+view|type|function|policy|trigger|index|extension|sequence)\b/i, label: "DROP" },
  { re: /\btruncate\b/i, label: "TRUNCATE" },
  { re: /\bdelete\s+from\b/i, label: "DELETE FROM" },
  { re: /\balter\s+table\b[^;]*\b(?:drop|rename)\b/i, label: "ALTER TABLE … DROP/RENAME" },
  { re: /\balter\s+column\b[^;]*\btype\b/i, label: "ALTER COLUMN … TYPE" },
  { re: /\bdisable\s+row\s+level\s+security\b/i, label: "DISABLE ROW LEVEL SECURITY" },
];

/**
 * Supprime commentaires, chaînes et corps de fonctions (exécutés plus tard, pas pendant la migration)
 * pour éviter les faux positifs. Les blocs « do $$ … $$ » sont conservés : ils s'exécutent pendant la migration.
 * @param {string} sql
 */
export function stripSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\b[\s\S]*?\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, " ")
    .replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * @param {string} file
 * @param {string} sql
 * @returns {string[]}
 */
export function findDestructiveSql(file, sql) {
  const clean = stripSql(sql);
  return DESTRUCTIVE.filter(({ re }) => re.test(clean)).map(({ label }) => `${file} : instruction destructive interdite (${label}).`);
}
