// @ts-check
// Vérifie le diff de la branche courante contre sa base : migrations existantes intactes,
// pas de .only/.skip, et pour les branches d'agent (task/*) aucun fichier protégé modifié.
import { execFileSync } from "node:child_process";
import { evaluateChanges } from "./rules.mjs";

const git = (/** @type {string[]} */ args) => execFileSync("git", args, { encoding: "utf8" });

const base = process.env.FACTORY_BASE_REF || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "");
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
const agent = branch.startsWith("task/") || process.env.FACTORY_AGENT === "1";

if (!base) {
  console.info("✓ Pas de branche de base (push direct) : contrôle du diff ignoré.");
  process.exit(0);
}

const range = `${base}...HEAD`;
const changes = git(["diff", "--name-status", "-M", range])
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [status = "", a = "", b] = l.split("\t");
    return b ? { status, path: b, oldPath: a } : { status, path: a };
  });

/** @type {{ path: string, line: string }[]} */
const addedLines = [];
let current = "";
for (const l of git(["diff", "-U0", range]).split("\n")) {
  if (l.startsWith("+++ b/")) current = l.slice(6);
  else if (l.startsWith("+") && !l.startsWith("+++")) addedLines.push({ path: current, line: l.slice(1) });
}

const violations = evaluateChanges(changes, addedLines, { agent });
if (violations.length) {
  console.error(`✗ Contrôle des fichiers (${agent ? "branche d'agent" : "branche humaine"}, base ${base}) :\n- ` + violations.join("\n- "));
  process.exit(1);
}
console.info(`✓ ${changes.length} fichier(s) modifié(s) vérifié(s) (${agent ? "agent" : "humain"}).`);
