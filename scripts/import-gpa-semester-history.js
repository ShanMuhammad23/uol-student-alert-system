const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const { Pool } = require("pg");

const DEFAULT_BASE_URL =
  "https://hub.uol.edu.pk/sap/opu/odata/sap/ZSLCM_ENROLLMENT_SRV/zenrollmentSet";
const TERM_NAMES = {
  "001": "spring",
  "002": "summer",
  "003": "fall",
};

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

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizePerid(value) {
  const raw = normalize(value);
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(Math.trunc(n)).padStart(3, "0");
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getAuthHeader() {
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  if (!username || !password) {
    throw new Error("SAP_USERNAME and SAP_PASSWORD must be set.");
  }
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function semesterKey(year, perid) {
  const name = TERM_NAMES[perid] || `term_${perid}`;
  return `${name}_${year}`;
}

function previousSemester(year, perid) {
  if (perid === "003") return { year, perid: "002" };
  if (perid === "002") return { year, perid: "001" };
  return { year: String(Number(year) - 1), perid: "003" };
}

function getSemesterSeries(startYear, startPerid, count) {
  const out = [];
  let current = { year: startYear, perid: startPerid };
  for (let i = 0; i < count; i++) {
    out.push(current);
    current = previousSemester(current.year, current.perid);
  }
  return out;
}

function getFilter(campus, year, perid, facCode) {
  const bits = [
    `CampCode eq '${campus}'`,
    `Peryr eq '${year}'`,
    `Perid eq '${perid}'`,
  ];
  if (facCode) bits.push(`FacCode eq '${facCode}'`);
  return `(${bits.join(" and ")})`;
}

function buildUrl(baseUrl, campus, year, perid, facCode, top, skip) {
  const url = new URL(baseUrl);
  url.searchParams.set("$filter", getFilter(campus, year, perid, facCode));
  url.searchParams.set("$top", String(top));
  url.searchParams.set("$skip", String(skip));
  return url.toString();
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseEntries(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
    maxNestedTags: 500000,
  });
  const doc = parser.parse(xmlText);
  return asArray(doc?.feed?.entry);
}

async function fetchTermRows({
  baseUrl,
  auth,
  campus,
  year,
  perid,
  facCode,
  top,
}) {
  let skip = 0;
  const rows = [];
  while (true) {
    const url = buildUrl(baseUrl, campus, year, perid, facCode, top, skip);
    const res = await fetch(url, {
      headers: {
        Authorization: auth,
        Accept: "application/atom+xml,application/xml,text/xml,*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `SAP enrollment API error (${year}/${perid}): ${res.status} ${res.statusText}`
      );
    }
    const xml = await res.text();
    const entries = parseEntries(xml);
    if (!entries.length) break;
    for (const entry of entries) {
      const props = entry?.content?.properties;
      if (!props) continue;
      rows.push(props);
    }
    if (entries.length < top) break;
    skip += top;
  }
  return rows;
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

async function getExistingStudents(pool) {
  const res = await pool.query("SELECT sap_id FROM students");
  return new Set(res.rows.map((r) => normalize(r.sap_id)).filter(Boolean));
}

async function upsertTermRows(pool, rows, year, perid) {
  const key = semesterKey(year, perid);
  let upserted = 0;
  for (const row of rows.values()) {
    const semJson = row.cgpa == null ? {} : { [key]: row.cgpa };
    const fall2025Value =
      year === "2025" && perid === "003" && row.cgpa != null ? row.cgpa : null;
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
        cgpa_semesters = COALESCE(student_gpa_profiles.cgpa_semesters, '{}'::jsonb) || EXCLUDED.cgpa_semesters,
        source_year = EXCLUDED.source_year,
        source_term = EXCLUDED.source_term,
        updated_at = NOW()
      `,
      [
        row.sap_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
        fall2025Value,
        JSON.stringify(semJson),
        year,
        perid,
      ]
    );
    upserted += 1;
  }
  return upserted;
}

function mergeByStudent(entries, year, perid, existingStudents) {
  const bySap = new Map();
  for (const props of entries) {
    const sapId = normalize(props.SapNo);
    if (!sapId) continue;
    if (existingStudents && !existingStudents.has(sapId)) continue;

    const row = bySap.get(sapId) ?? {
      sap_id: sapId,
      department_id: null,
      course_id: null,
      faculty_id: null,
      cgpa: null,
    };
    const deptId = normalize(props.DeptId);
    const courseId = normalize(props.CrCode);
    const facultyId = normalize(props.FacId);
    const peryr = normalize(props.Peryr);
    const term = normalizePerid(props.Perid);
    const cgpa = toNumber(props.Cgpa);

    if (!row.department_id && deptId) row.department_id = deptId;
    if (!row.course_id && courseId) row.course_id = courseId;
    if (!row.faculty_id && facultyId) row.faculty_id = facultyId;
    if (peryr === year && term === perid && cgpa != null) row.cgpa = cgpa;

    bySap.set(sapId, row);
  }
  return bySap;
}

async function main() {
  loadDotEnv();

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const campus = normalize(process.env.SAP_CAMPUS || "11");
  const facCode = normalize(process.env.SAP_FAC_CODE || "1117");
  const startYear = normalize(process.env.GPA_IMPORT_START_YEAR || "2023");
  const startPerid = normalizePerid(process.env.GPA_IMPORT_START_PERID || "003");
  const semesterCount = Number(process.env.GPA_IMPORT_SEMESTER_COUNT || 8);
  const top = Number(process.env.GPA_IMPORT_TOP || 250000);
  const baseUrl = normalize(process.env.SAP_ENROLLMENT_BASE_URL || DEFAULT_BASE_URL);
  const auth = getAuthHeader();

  const terms = getSemesterSeries(startYear, startPerid, semesterCount);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureTable(pool);
    const existingStudents = await getExistingStudents(pool);

    let totalFetchedRows = 0;
    let totalUpserted = 0;
    for (const term of terms) {
      const rows = await fetchTermRows({
        baseUrl,
        auth,
        campus,
        year: term.year,
        perid: term.perid,
        facCode,
        top,
      });
      totalFetchedRows += rows.length;
      const merged = mergeByStudent(rows, term.year, term.perid, existingStudents);
      const upserted = await upsertTermRows(pool, merged, term.year, term.perid);
      totalUpserted += upserted;
      console.log(
        `[${term.year}/${term.perid}] fetched=${rows.length} students_with_cgpa=${Array.from(
          merged.values()
        ).filter((r) => r.cgpa != null).length} upserted=${upserted}`
      );
    }

    console.log(`Done. semesters=${terms.length} total_fetched_rows=${totalFetchedRows} total_upserted=${totalUpserted}`);
    console.log(`Terms: ${terms.map((t) => `${t.year}/${t.perid}`).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("GPA import failed:", err?.message || err);
  process.exit(1);
});

