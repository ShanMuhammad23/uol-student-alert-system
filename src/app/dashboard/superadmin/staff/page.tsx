import { pool } from "@/lib/db";
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

export default async function SuperadminStaffPage() {
  const staff = await getStaffList();

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
