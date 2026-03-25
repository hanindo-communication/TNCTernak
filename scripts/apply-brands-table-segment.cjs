/**
 * Menjalankan supabase/migrations/003_brands_table_segment.sql lewat koneksi Postgres.
 * Syarat: DATABASE_URL di .env.local (Supabase → Project Settings → Database → URI).
 * Usage: npm run db:apply-segment
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function stripLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

async function main() {
  const fromFile = loadEnvLocal();
  const url =
    process.env.DATABASE_URL || fromFile.DATABASE_URL || fromFile.DIRECT_URL;
  if (!url) {
    console.error(
      "DATABASE_URL tidak ditemukan. Tambahkan di .env.local:\n" +
        "  DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres\n" +
        "Password: Supabase → Project Settings → Database → Database password.",
    );
    process.exit(1);
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "003_brands_table_segment.sql",
  );
  let sql = fs.readFileSync(sqlPath, "utf8");
  sql = stripLineComments(sql);
  const parts = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const chunk of parts) {
      const q = chunk.endsWith(";") ? chunk : `${chunk};`;
      await client.query(q);
    }
  } finally {
    await client.end();
  }
  console.log("Selesai: kolom public.brands.table_segment + NOTIFY pgrst.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
