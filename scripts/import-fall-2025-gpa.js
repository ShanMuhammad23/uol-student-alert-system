const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const { Pool } = require("pg");

const XML_PATH = path.join(process.cwd(), "public", "Filtered_Enrollment_data.xml");
const TERM_KEY = "fall_2025";
const TERM_YEAR = "2025";
const TERM_PERID = "003";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizePerid(value) {
  const raw = normalize(value);
  if (!raw) return "";
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  return String(Math.trunc(num)).padStart(3, "0");
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseXmlRecords(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
    maxNestedTags: 500000,
  });
  const doc = parser.parse(xmlText);
  const entries = asArray(doc?.feed?.entry);

  const bySap = new Map();
  for (const entry of entries) {
    const props = entry?.content?.properties;
    if (!props) continue;

    const sapId = normalize(props.SapNo);
    if (!sapId) continue;

    const row = bySap.get(sapId) ?? {
      sap_id: sapId,
      department_id: null,
      course_id: null,
      faculty_id: null,
      cgpa_fall_2025: null,
    };

    const deptId = normalize(props.DeptId);
    const courseId = normalize(props.CrCode);
    const facultyId = normalize(props.FacId);
    const peryr = normalize(props.Peryr);
    const perid = normalizePerid(props.Perid);
    const cgpa = toNumber(props.Cgpa);

    if (!row.department_id && deptId) row.department_id = deptId;
    if (!row.course_id && courseId) row.course_id = courseId;
    if (!row.faculty_id && facultyId) row.faculty_id = facultyId;

    if (peryr === TERM_YEAR && perid === TERM_PERID && cgpa != null) {
      row.cgpa_fall_2025 = cgpa;
    }

    bySap.set(sapId, row);
  }

  return Array.from(bySap.values());
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_gpa_profiles (
      sap_id VARCHAR(32) PRIMARY KEY,
      department_id VARCHAR(32),
      course_id VARCHAR(64),
      faculty_id VARCHAR(32),
      cgpa_fall_2025 NUMERIC(4,2),
      cgpa_semesters JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_year VARCHAR(4),
      source_term VARCHAR(3),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_student_gpa_profiles_faculty_id ON student_gpa_profiles(faculty_id);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_student_gpa_profiles_department_id ON student_gpa_profiles(department_id);`
  );
}

async function upsertRows(pool, rows) {
  for (const row of rows) {
    const semJson = row.cgpa_fall_2025 == null ? {} : { [TERM_KEY]: row.cgpa_fall_2025 };
    await pool.query(
      `
      INSERT INTO student_gpa_profiles (
        sap_id, department_id, course_id, faculty_id,
        cgpa_fall_2025, cgpa_semesters, source_year, source_term
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
      ON CONFLICT (sap_id)
      DO UPDATE SET
        department_id = COALESCE(EXCLUDED.department_id, student_gpa_profiles.department_id),
        course_id = COALESCE(EXCLUDED.course_id, student_gpa_profiles.course_id),
        faculty_id = COALESCE(EXCLUDED.faculty_id, student_gpa_profiles.faculty_id),
        cgpa_fall_2025 = COALESCE(EXCLUDED.cgpa_fall_2025, student_gpa_profiles.cgpa_fall_2025),
        cgpa_semesters = student_gpa_profiles.cgpa_semesters || EXCLUDED.cgpa_semesters,
        source_year = EXCLUDED.source_year,
        source_term = EXCLUDED.source_term,
        updated_at = NOW()
      `,
      [
        row.sap_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
        row.cgpa_fall_2025,
        JSON.stringify(semJson),
        TERM_YEAR,
        TERM_PERID,
      ]
    );
  }
}

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!fs.existsSync(XML_PATH)) {
    throw new Error(`XML file not found: ${XML_PATH}`);
  }

  const xml = fs.readFileSync(XML_PATH, "utf-8");
  const rows = parseXmlRecords(xml);
  const fallFilled = rows.filter((r) => r.cgpa_fall_2025 != null).length;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureTable(pool);
    await upsertRows(pool, rows);
  } finally {
    await pool.end();
  }

  console.log(`Imported students: ${rows.length}`);
  console.log(`Fall 2025 CGPA filled: ${fallFilled}`);
}

main().catch((err) => {
  console.error("Import failed:", err.message || err);
  process.exit(1);
});
