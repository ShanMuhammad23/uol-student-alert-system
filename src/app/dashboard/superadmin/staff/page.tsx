import { pool } from "@/lib/db";

type StaffListRow = {
  id: string;
  pernr: string;
  name: string;
  email: string;
  role: "superadmin" | "dean" | "hod" | "instructor";
  faculty_id: string | null;
};

async function getStaffList(): Promise<StaffListRow[]> {
  if (!pool) return [];
  const res = await pool.query<StaffListRow>(
    `SELECT id, pernr, name, email, role, faculty_id
     FROM staff
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stroke dark:border-dark-3">
                  <th className="px-3 py-2 text-left font-semibold text-dark dark:text-white">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-dark dark:text-white">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-dark dark:text-white">
                    Role
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-dark dark:text-white">
                    Pernr
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-dark dark:text-white">
                    Faculty
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-stroke/70 dark:border-dark-3/70"
                  >
                    <td className="px-3 py-2 text-dark dark:text-white">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 text-dark-5 dark:text-dark-6">
                      {row.email}
                    </td>
                    <td className="px-3 py-2 text-dark dark:text-white">
                      {row.role}
                    </td>
                    <td className="px-3 py-2 text-dark-5 dark:text-dark-6">
                      {row.pernr}
                    </td>
                    <td className="px-3 py-2 text-dark-5 dark:text-dark-6">
                      {row.faculty_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
