/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const outPath =
  process.env.OUT_SQL_PATH ||
  path.join(process.cwd(), "scripts", "alert-counts-upsert.sql");

function sqlEscape(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function buildSql(rows) {
  const values = rows
    .map((row) => {
      return `('${sqlEscape(row.snapshot_date)}', '${sqlEscape(
        row.dimension_type
      )}', '${sqlEscape(row.dimension_id)}', '${sqlEscape(
        row.dimension_name
      )}', ${Number(row.total_students) || 0}, ${Number(row.yellow_gpa) || 0}, ${
        Number(row.red_gpa) || 0
      }, ${Number(row.yellow_attendance) || 0}, ${
        Number(row.red_attendance) || 0
      })`;
    })
    .join(",\n  ");

  return `INSERT INTO alert_counts_by_dimension (
  snapshot_date,
  dimension_type,
  dimension_id,
  dimension_name,
  total_students,
  yellow_gpa,
  red_gpa,
  yellow_attendance,
  red_attendance
)
VALUES
  ${values}
ON CONFLICT (snapshot_date, dimension_type, dimension_id)
DO UPDATE SET
  dimension_name = EXCLUDED.dimension_name,
  total_students = EXCLUDED.total_students,
  yellow_gpa = EXCLUDED.yellow_gpa,
  red_gpa = EXCLUDED.red_gpa,
  yellow_attendance = EXCLUDED.yellow_attendance,
  red_attendance = EXCLUDED.red_attendance;
`;
}

async function main() {
  const url = `${baseUrl}/api/dashboard/alert-counts`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API failed (${res.status}): ${text}`);
  }
  const payload = await res.json();
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!rows.length) {
    throw new Error("No rows returned by /api/dashboard/alert-counts");
  }

  const sql = buildSql(rows);
  fs.writeFileSync(outPath, sql, "utf8");
  console.log(`Built SQL for ${rows.length} rows`);
  console.log(`Written: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

