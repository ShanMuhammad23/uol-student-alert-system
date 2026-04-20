import { pool } from "@/lib/db";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
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
import { StaffDetailsDialog } from "./_components/StaffDetailsDialog";
import { AddStaffForm } from "./_components/AddStaffForm";

type StaffListRow = {
  id: string;
  pernr: string;
  name: string;
  img: string | null;
  email: string;
  role: "superadmin" | "dean" | "hod" | "instructor" | "wellbeing";
  faculty_id: string | null;
  faculty_name: string | null;
  department_names: string[] | null;
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

function resolveFacultyName(row: StaffListRow): string {
  return resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name) ?? "—";
}

function resolveDepartmentNames(row: StaffListRow): string[] {
  return (row.department_names ?? []).filter((name) => name.trim().length > 0);
}

async function getStaffList(): Promise<StaffListRow[]> {
  if (!pool) return [];
  const res = await pool.query<StaffListRow>(
    `SELECT
       s.id,
       s.pernr,
       s.name,
       s.img,
       s.email,
       s.role,
       s.faculty_id,
       f.name AS faculty_name,
       COALESCE(
         ARRAY_AGG(DISTINCT d.name) FILTER (WHERE d.name IS NOT NULL),
         ARRAY[]::text[]
       ) AS department_names
     FROM staff s
     LEFT JOIN faculties f ON f.id = s.faculty_id
     LEFT JOIN staff_departments sd ON sd.staff_id = s.id
     LEFT JOIN departments d ON d.id = sd.department_id
     GROUP BY s.id, s.pernr, s.name, s.img, s.email, s.role, s.faculty_id, f.name
     ORDER BY s.role ASC, s.name ASC`
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
    | "instructor"
    | "wellbeing";
  const facultyIdRaw = String(formData.get("faculty_id") ?? "").trim();
  const facultyId = facultyIdRaw.length ? facultyIdRaw : null;

  if (!name || !email || !pernr || !password || !role) {
    redirect("/dashboard/superadmin/staff?error=missing_required");
  }
  if (!["superadmin", "dean", "hod", "instructor", "wellbeing"].includes(role)) {
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
          Add superadmin, dean, hod, instructor, or wellbeing accounts.
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

        <AddStaffForm
          action={createStaffAction}
          faculties={faculties}
          departments={departments.map((department) => ({
            id: department.id,
            name: department.name,
          }))}
        />
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
                  <TableHead className="min-w-[240px]">Departments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((row) => (
                  <TableRow
                    key={row.id}
                    className="text-base font-medium text-dark dark:text-white"
                  >
                    <TableCell className="!text-left font-medium text-dark dark:text-white">
                      <StaffDetailsDialog
                        staff={{
                          name: row.name || "—",
                          img: row.img,
                          email: row.email,
                          role: row.role,
                          pernr: row.pernr || "—",
                          facultyName: resolveFacultyName(row),
                          departments: resolveDepartmentNames(row),
                        }}
                      />
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
                    <TableCell className="!text-left text-dark-6">
                      {(row.role === "hod" || row.role === "instructor") &&
                      resolveDepartmentNames(row).length
                        ? resolveDepartmentNames(row).join(", ")
                        : "—"}
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
