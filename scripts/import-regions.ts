/**
 * One-off import: Indonesia's official administrative regions -> `regions`.
 *
 * Run manually, never deployed:
 *   npx tsx scripts/import-regions.ts
 *
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (service role bypasses RLS for the bulk load). Requires the `regions`
 * table from supabase/schema.sql to already exist (run that migration in
 * the Supabase SQL editor first).
 *
 * Source: cahyadsn/wilayah (Kepmendagri region codes), a MySQL dump of a
 * single `wilayah(kode, nama)` table where the code itself encodes the
 * hierarchy via dot-separated segments, e.g.:
 *   "32"             -> province
 *   "32.04"          -> city/regency
 *   "32.04.05"       -> kecamatan
 *   "32.04.05.2001"  -> kelurahan/desa
 * parent_code is just that string with its last segment removed (null for
 * provinces). No postal codes in this dataset — checkout collects that as
 * a manual field instead.
 *
 * Safe to re-run: upserts on the `code` primary key.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const SOURCE_URL = "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql";
const BATCH_SIZE = 2000;

type Region = { code: string; name: string; parent_code: string | null };

function parentCodeOf(code: string): string | null {
  const lastDot = code.lastIndexOf(".");
  return lastDot === -1 ? null : code.slice(0, lastDot);
}

// Matches each `('code','name')` tuple in the SQL INSERT statements, with
// '' as the MySQL-dump escape for a literal single quote (e.g. `Ba''u`).
const TUPLE_RE = /\('([\d.]+)','((?:[^']|'')*)'\)/g;

function parseTuples(sql: string): Region[] {
  const regions: Region[] = [];
  for (const match of sql.matchAll(TUPLE_RE)) {
    const [, code, rawName] = match;
    regions.push({ code, name: rawName.replace(/''/g, "'"), parent_code: parentCodeOf(code) });
  }
  return regions;
}

async function main() {
  console.log("Fetching region data from", SOURCE_URL);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Failed to fetch region dump: ${res.status} ${res.statusText}`);
  const sql = await res.text();

  const regions = parseTuples(sql);
  console.log(`Parsed ${regions.length} regions`);
  if (regions.length < 90000) {
    throw new Error(`Expected ~91,000+ regions, got ${regions.length} — source format may have changed`);
  }

  for (let i = 0; i < regions.length; i += BATCH_SIZE) {
    const batch = regions.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("regions").upsert(batch, { onConflict: "code" });
    if (error) throw new Error(`Batch starting at ${i} failed: ${error.message}`);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, regions.length)} / ${regions.length}`);
  }

  console.log("Done.");
}

main();
