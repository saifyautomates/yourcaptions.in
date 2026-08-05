#!/usr/bin/env node
/**
 * Static security check: flag any SECURITY DEFINER function declared in
 * supabase/migrations/*.sql that receives EXECUTE grants to PUBLIC or `anon`
 * (or `authenticated`, when not explicitly allowlisted).
 *
 * SECURITY DEFINER runs with the owner's privileges, bypassing RLS on tables
 * it touches. Granting EXECUTE to PUBLIC/anon on such a function is a
 * privilege-escalation vector unless the function performs its own
 * authorization checks or returns strictly non-sensitive data.
 *
 * Fails the build (exit code 1) when a violation is found and the function is
 * not listed in security/allowed-security-definer.json.
 *
 * Run: `node scripts/check-security-definer.mjs`
 * Also wired into `prebuild` in package.json.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const ALLOWLIST_PATH = path.join(REPO_ROOT, "security", "allowed-security-definer.json");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function readAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return new Set();
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
  return new Set((raw.allowed ?? []).map((n) => n.toLowerCase()));
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

/**
 * Track the definer-ness of each function across the whole migration history.
 * A later CREATE OR REPLACE without SECURITY DEFINER effectively demotes it,
 * so we honor the latest definition seen in file/order.
 */
function scanMigrations(files) {
  // key: 'schema.name' (lowercase) → { definer: boolean, file: string }
  const funcs = new Map();
  const grants = [];

  // Match the CREATE FUNCTION header (schema.name). Body detection is done by
  // slicing until the next top-level CREATE/GRANT/REVOKE/ALTER/COMMENT/-- separator
  // and looking for SECURITY DEFINER inside that slice.
  const createRe =
    /create\s+(?:or\s+replace\s+)?function\s+([a-z_][\w]*\.)?([a-z_][\w]*)\s*\(/gi;
  const bodyEndRe =
    /(?:^|\n)\s*(?:create\s+(?:or\s+replace\s+)?function|create\s+table|create\s+policy|create\s+trigger|alter\s+table|alter\s+function|grant\s+|revoke\s+|comment\s+on)/i;
  const grantRe =
    /grant\s+execute\s+on\s+function\s+([a-z_][\w]*\.)?([a-z_][\w]*)\s*(\([^)]*\))?\s+to\s+([a-z_,\s"]+?)\s*;/gi;

  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");

    createRe.lastIndex = 0;
    let m;
    while ((m = createRe.exec(sql)) !== null) {
      const schema = (m[1] ?? "public.").replace(/\.$/, "").toLowerCase();
      const name = m[2].toLowerCase();
      const after = sql.slice(m.index + m[0].length);
      // Slice up to next top-level statement start (or end of file).
      const endMatch = bodyEndRe.exec(after);
      const body = endMatch ? after.slice(0, endMatch.index) : after;
      const isDefiner = /\bsecurity\s+definer\b/i.test(body);
      // Later declarations override earlier ones (CREATE OR REPLACE demote/promote).
      funcs.set(`${schema}.${name}`, { definer: isDefiner, file });
    }

    grantRe.lastIndex = 0;
    while ((m = grantRe.exec(sql)) !== null) {
      const schema = (m[1] ?? "public.").replace(/\.$/, "").toLowerCase();
      const name = m[2].toLowerCase();
      const grantees = m[4]
        .split(",")
        .map((g) => g.trim().replace(/"/g, "").toLowerCase())
        .filter(Boolean);
      const lineNo = sql.slice(0, m.index).split("\n").length;
      for (const grantee of grantees) {
        grants.push({ schema, name, grantee, file, line: lineNo });
      }
    }
  }

  return { funcs, grants };
}

function main() {
  const files = listMigrationFiles();
  if (files.length === 0) {
    console.log(`${DIM}[security] no migrations found — skipping SECURITY DEFINER audit${RESET}`);
    return;
  }
  const allowlist = readAllowlist();
  const { funcs, grants } = scanMigrations(files);

  // Postgres implicitly grants EXECUTE on new functions to PUBLIC. Treat every
  // SECURITY DEFINER function as if it has an implicit PUBLIC grant unless a
  // REVOKE ... FROM PUBLIC appears in migrations. We keep this simple: any
  // SECURITY DEFINER function must be in the allowlist OR have an explicit
  // REVOKE from PUBLIC in the migrations.
  const implicitViolations = [];
  const publicRevoked = new Set();
  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");
    const re =
      /revoke\s+(?:all(?:\s+privileges)?|execute)\s+on\s+function\s+([a-z_][\w]*\.)?([a-z_][\w]*)\s*(\([^)]*\))?\s+from\s+([a-z_,\s"]+?)\s*;/gi;
    let m;
    while ((m = re.exec(sql)) !== null) {
      const schema = (m[1] ?? "public.").replace(/\.$/, "").toLowerCase();
      const name = m[2].toLowerCase();
      const grantees = m[4].split(",").map((g) => g.trim().replace(/"/g, "").toLowerCase());
      if (grantees.includes("public")) publicRevoked.add(`${schema}.${name}`);
    }
  }

  const violations = [];

  // Explicit grants to PUBLIC/anon on definer functions
  for (const g of grants) {
    const key = `${g.schema}.${g.name}`;
    const info = funcs.get(key);
    if (!info || !info.definer) continue;
    if (!["public", "anon", "authenticated"].includes(g.grantee)) continue;
    if (allowlist.has(key)) continue;
    violations.push({
      key,
      grantee: g.grantee,
      file: path.relative(REPO_ROOT, g.file),
      line: g.line,
      kind: "explicit_grant",
    });
  }

  // Implicit PUBLIC grant on definer functions with no REVOKE and no allowlist
  for (const [key, info] of funcs) {
    if (!info.definer) continue;
    if (allowlist.has(key)) continue;
    if (publicRevoked.has(key)) continue;
    // If it was already caught as an explicit grant, skip to avoid noise.
    if (violations.some((v) => v.key === key && v.kind === "explicit_grant")) continue;
    implicitViolations.push({
      key,
      grantee: "PUBLIC (implicit)",
      file: path.relative(REPO_ROOT, info.file),
      line: 0,
      kind: "implicit_grant",
    });
  }

  const all = [...violations, ...implicitViolations];

  console.log(
    `${DIM}[security] scanned ${files.length} migration${files.length === 1 ? "" : "s"}, ` +
      `${funcs.size} function${funcs.size === 1 ? "" : "s"} — ` +
      `${[...funcs.values()].filter((f) => f.definer).length} SECURITY DEFINER${RESET}`,
  );

  if (all.length === 0) {
    console.log(`${GREEN}[security] no unexpected PUBLIC/anon EXECUTE grants on SECURITY DEFINER functions.${RESET}`);
    return;
  }

  console.error(
    `\n${RED}${BOLD}[security] ${all.length} SECURITY DEFINER violation${all.length === 1 ? "" : "s"} detected:${RESET}\n`,
  );
  for (const v of all) {
    const tag =
      v.kind === "implicit_grant"
        ? `${YELLOW}implicit PUBLIC EXECUTE${RESET}`
        : `${RED}EXECUTE granted to ${v.grantee}${RESET}`;
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.error(`  • ${BOLD}${v.key}${RESET} — ${tag}  ${DIM}(${loc})${RESET}`);
  }
  console.error(
    `\n${DIM}Fix by either:\n` +
      `  1. Adding \`REVOKE EXECUTE ON FUNCTION <name> FROM PUBLIC;\` in a new migration, or\n` +
      `  2. Documenting the function in ${path.relative(REPO_ROOT, ALLOWLIST_PATH)} (must be safe-by-design or self-authorized).${RESET}\n`,
  );
  process.exit(1);
}

main();
