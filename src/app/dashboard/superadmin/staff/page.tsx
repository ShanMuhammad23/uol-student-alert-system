import { pool } from "@/lib/db";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StaffListRow = {
  id: string;
  pernr: string;
  name: string;
  email: string;
  role: "superadmin" | "dean" | "hod" | "instructor";
  faculty_id: string | null;
  faculty_name: string | null;
};

type FacultyRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  faculty_id: string | null;
};

const FACULTY_NAME_FALLBACK: Record<string, string> = {
  "50000172": "Faculty of Social Sciences",
};

function resolveFacultyName(row: StaffListRow): string {
  const dbName = (row.faculty_name ?? "").trim();
  const isPlaceholder =
    /^Faculty\s+\d+$/i.test(dbName) || dbName.length === 0;
  if (!isPlaceholder) return dbName;
  if (row.faculty_id && FACULTY_NAME_FALLBACK[row.faculty_id]) {
    return FACULTY_NAME_FALLBACK[row.faculty_id];
  }
  return row.faculty_id ?? "—";
}

async function getStaffList(): Promise<StaffListRow[]> {
  if (!pool) return [];
  const res = await pool.query<StaffListRow>(
    `SELECT s.id, s.pernr, s.name, s.email, s.role, s.faculty_id, f.name AS faculty_name
     FROM staff s
     LEFT JOIN faculties f ON f.id = s.faculty_id
     ORDER BY role ASC, name ASC`
  );
  return res.rows;
}

async function getFaculties(): Promise<FacultyRow[]> {
  if (!pool) return [];
  const res = await pool.query<FacultyRow>(
    `SELECT id, name FROM faculties ORDER BY name ASC`
  );
  return res.rows;
}

async function getDepartments(): Promise<DepartmentRow[]> {
  if (!pool) return [];
  const res = await pool.query<DepartmentRow>(
    `SELECT id, name, code, faculty_id
     FROM departments
     ORDER BY name ASC`
  );
  return res.rows;
}

async function createStaffAction(formData: FormData) {
  "use server";
  if (!pool) {
    redirect("/dashboard/superadmin/staff?error=db_not_configured");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pernr = String(formData.get("pernr") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor";
  const facultyIdRaw = String(formData.get("faculty_id") ?? "").trim();
  const facultyId = facultyIdRaw.length ? facultyIdRaw : null;

  if (!name || !email || !pernr || !password || !role) {
    redirect("/dashboard/superadmin/staff?error=missing_required");
  }
  if (!["superadmin", "dean", "hod", "instructor"].includes(role)) {
    redirect("/dashboard/superadmin/staff?error=invalid_role");
  }
  if ((role === "dean" || role === "instructor") && !facultyId) {
    redirect("/dashboard/superadmin/staff?error=faculty_required");
  }

  const passwordHash = await hash(password, 10);
  const departmentIds = formData
    .getAll("department_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertStaff = await client.query<{ id: string }>(
      `INSERT INTO staff (pernr, name, email, password_hash, role, faculty_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [pernr, name, email, passwordHash, role, facultyId]
    );
    const staffId = insertStaff.rows[0]?.id;

    if (role === "hod" && staffId && departmentIds.length) {
      for (const departmentId of departmentIds) {
        await client.query(
          `INSERT INTO staff_departments (staff_id, department_id)
           VALUES ($1, $2)
           ON CONFLICT (staff_id, department_id) DO NOTHING`,
          [staffId, departmentId]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    const code =
      typeof error === "object" && error != null && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";
    if (code === "23505") {
      redirect("/dashboard/superadmin/staff?error=duplicate");
    }
    redirect("/dashboard/superadmin/staff?error=create_failed");
  } finally {
    client.release();
  }

  revalidatePath("/dashboard/superadmin/staff");
  redirect("/dashboard/superadmin/staff?success=created");
}

export default async function SuperadminStaffPage(props: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const staff = await getStaffList();
  const faculties = await getFaculties();
  const departments = await getDepartments();
  const successMessage =
    searchParams.success === "created" ? "Staff added successfully." : null;
  const errorMessage =
    searchParams.error === "missing_required"
      ? "Please fill all required fields."
      : searchParams.error === "invalid_role"
      ? "Selected role is invalid."
      : searchParams.error === "faculty_required"
      ? "Faculty is required for Dean and Instructor."
      : searchParams.error === "duplicate"
      ? "Email or Pernr already exists."
      : searchParams.error === "db_not_configured"
      ? "Database is not configured."
      : searchParams.error === "create_failed"
      ? "Unable to add staff. Please verify field values."
      : null;

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          Staff Directory
        </h1>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Manage and review all system staff accounts.
        </p>
      </div>

      <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Add Staff
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Add superadmin, dean, hod, or instructor accounts.
        </p>

        {successMessage && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            {successMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        <form action={createStaffAction} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Name *</label>
            <input
              name="name"
              required
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
              placeholder="Staff full name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Email *</label>
            <input
              type="email"
              name="email"
              required
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
              placeholder="name@uol.edu.pk"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Pernr *</label>
            <input
              name="pernr"
              required
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
              placeholder="e.g. 00016932"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Password *</label>
            <input
              type="password"
              name="password"
              required
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
              placeholder="Set initial password"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Role *</label>
            <select
              name="role"
              required
              defaultValue="instructor"
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              <option value="superadmin">superadmin</option>
              <option value="dean">dean</option>
              <option value="hod">hod</option>
              <option value="instructor">instructor</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Faculty</label>
            <select
              name="faculty_id"
              defaultValue=""
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              <option value="">Select faculty (optional)</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">
              HoD Departments
            </label>
            <select
              name="department_ids"
              multiple
              className="min-h-32 rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-dark-5 dark:text-dark-6">
              Use Ctrl/Cmd + click to select multiple departments for HoD.
            </p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add Staff
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        {staff.length === 0 ? (
          <p className="text-sm text-dark-5 dark:text-dark-6">
            No staff records found.
          </p>
        ) : (
          <div className="mt-4">
            <Table>
              <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
                <TableRow className="border-none uppercase [&>th]:!text-left [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                  <TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead className="min-w-[220px]">Email</TableHead>
                  <TableHead className="min-w-[120px]">Role</TableHead>
                  <TableHead className="min-w-[120px]">Pernr</TableHead>
                  <TableHead className="min-w-[220px]">Faculty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((row) => (
                  <TableRow
                    key={row.id}
                    className="text-base font-medium text-dark dark:text-white"
                  >
                    <TableCell className="!text-left font-medium text-dark dark:text-white">
                      {row.name || "—"}
                    </TableCell>
                    <TableCell className="!text-left text-dark-6">
                      {row.email}
                    </TableCell>
                    <TableCell className="!text-left text-dark dark:text-white">
                      {row.role}
                    </TableCell>
                    <TableCell className="!text-left text-dark-6">
                      {row.pernr || "—"}
                    </TableCell>
                    <TableCell className="!text-left text-dark-6">
                      {resolveFacultyName(row)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
