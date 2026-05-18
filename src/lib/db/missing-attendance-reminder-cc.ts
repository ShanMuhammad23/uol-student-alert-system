import { pool } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(value: string | null | undefined): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

export type MissingAttendanceReminderCcLookup = {
  deanEmails: string[];
  hodEmailsByDepartment: Map<string, string[]>;
  resolveCc: (departmentId: string | null, excludeTo?: string | null) => string[];
};

/** Dean (faculty) + HoD (department) CC list from staff.pseudo_role. */
export async function loadMissingAttendanceReminderCcLookup(
  facultyId: string
): Promise<MissingAttendanceReminderCcLookup> {
  const deanEmails: string[] = [];
  const hodEmailsByDepartment = new Map<string, string[]>();

  if (!pool) {
    return {
      deanEmails,
      hodEmailsByDepartment,
      resolveCc: () => [],
    };
  }

  const deanRes = await pool.query<{ email: string }>(
    `SELECT DISTINCT LOWER(TRIM(s.email)) AS email
     FROM staff s
     WHERE s.pseudo_role = 'dean'
       AND s.faculty_id = $1
       AND s.email IS NOT NULL
       AND TRIM(s.email) <> ''`,
    [facultyId]
  );
  for (const row of deanRes.rows) {
    const email = normalizeEmail(row.email);
    if (email) deanEmails.push(email);
  }

  const hodRes = await pool.query<{ department_id: string; email: string }>(
    `SELECT DISTINCT
       sd.department_id,
       LOWER(TRIM(s.email)) AS email
     FROM staff s
     INNER JOIN staff_departments sd ON sd.staff_id = s.id
     INNER JOIN departments d ON d.id = sd.department_id
     WHERE s.pseudo_role = 'hod'
       AND d.faculty_id = $1
       AND s.email IS NOT NULL
       AND TRIM(s.email) <> ''`,
    [facultyId]
  );
  for (const row of hodRes.rows) {
    const email = normalizeEmail(row.email);
    const deptId = String(row.department_id ?? "").trim();
    if (!email || !deptId) continue;
    const list = hodEmailsByDepartment.get(deptId) ?? [];
    if (!list.includes(email)) list.push(email);
    hodEmailsByDepartment.set(deptId, list);
  }

  const uniqueDeans = [...new Set(deanEmails)];

  return {
    deanEmails: uniqueDeans,
    hodEmailsByDepartment,
    resolveCc(departmentId: string | null, excludeTo?: string | null) {
      const exclude = normalizeEmail(excludeTo);
      const out: string[] = [];
      const seen = new Set<string>();

      const add = (email: string | null) => {
        if (!email || (exclude && email === exclude) || seen.has(email)) return;
        seen.add(email);
        out.push(email);
      };

      for (const email of uniqueDeans) add(email);

      const deptId = String(departmentId ?? "").trim();
      if (deptId) {
        for (const email of hodEmailsByDepartment.get(deptId) ?? []) {
          add(email);
        }
      }

      return out;
    },
  };
}
