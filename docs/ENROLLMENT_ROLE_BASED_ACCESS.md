# Role-Based Access from enrollment_data.json + Database Staff

This doc describes how to wire **database-backed staff** (Dean, HoD, Instructor) so the dashboard is driven by **enrollment_data.json** only (no dependency on data.json for users or for dashboard data).

**Auth:** Login is implemented with **NextAuth** (Credentials provider), **bcrypt**-hashed passwords, and **PostgreSQL** (`staff` table). Session/JWT includes `id`, `pernr`, `role`, `faculty_id`, `department_ids` so the app can filter data by session. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` in `.env` (see `.env.example`).

---

## 1. SQL schema and seed (done)

- **Location:** `scripts/schema.sql`
- **DB:** PostgreSQL (uses `gen_random_uuid()`; for MySQL use `UUID()` or a different default).

Run once:

```bash
psql -U your_user -d your_database -f scripts/schema.sql
```

Or from your app: run the SQL in order (faculties → departments → staff → staff_departments → courses).

**Tables:**

| Table             | Purpose |
|-------------------|--------|
| `faculties`       | id = `FacId` from enrollment_data.json |
| `departments`      | id = `DeptId`, code = `DeptCode`, faculty_id = `FacId` |
| `staff`           | One row per user; `pernr` = employee number (for instructors = `Pernr` in enrollment) |
| `staff_departments` | HoD only: which departments they head (department_id = `DeptId`) |
| `courses`         | Optional; id = `CrCode` from enrollment |

**Seed users:**

- **Dean:** faculty_id = `50000172`, email `dean@uol.edu.pk`
- **HoD:** heads department `51517449`, email `hod.criminology@uol.edu.pk`
- **Instructor:** pernr = `00016932` (Maleeha Amjad), email `maleeha.amjad@law.uol.edu.pk`

Replace `password_hash` with a real bcrypt hash in your app or a one-off seed script.

---

## 2. Map DB staff → app user shape

Your app expects an `AppUser` / `DashboardUser` with:

- `id`, `sap_id` (or equivalent), `name`, `email`, `role`
- **Dean:** `faculty_id` (FacId), `department_id` = null, `department_ids` = null, `course_ids` = null
- **HoD:** `faculty_id` = null, `department_ids` = array of DeptIds they head, `course_ids` = null
- **Instructor:** `faculty_id` optional, `department_id` optional, `course_ids` = null (scope comes from enrollment by Pernr)

Add a **data access layer** that loads staff by email and maps to this shape:

```ts
// Example: getStaffByEmail(email) → AppUser
type AppUser = {
  id: string;           // staff.id (UUID)
  sap_id: string;       // staff.pernr
  name: string;
  email: string;
  role: "dean" | "hod" | "teacher";  // map DB 'instructor' → 'teacher'
  faculty_id: string | null;         // staff.faculty_id (Dean)
  department_id: string | null;      // single dept if needed (e.g. Instructor)
  department_ids: string[] | null;   // from staff_departments for HoD
  course_ids: string[] | null;       // leave null; scope by Pernr for Instructor
};
```

- **Dean:** `faculty_id = staff.faculty_id`, `department_ids = null`
- **HoD:** `faculty_id = null`, `department_ids = [department_id from staff_departments]`
- **Instructor:** `faculty_id = staff.faculty_id` (optional), `department_id`/`department_ids` as needed; **instructor scope = all rows in enrollment where `Pernr === staff.pernr`**

Use the same role string the UI expects: store as `dean` / `hod` / `instructor` in DB and map `instructor` → `teacher` when building `AppUser` if your front-end uses `teacher`.

---

## 3. Auth: use DB instead of data.json users

- **getCurrentUser()**  
  Resolve user from session/cookie (e.g. email), then load staff by email from DB and return the mapped `AppUser`. Remove the `data.json` `users` lookup.

- **findUserByEmailAndPassword(email, password)**  
  Load staff by email from DB; verify password against `staff.password_hash` (bcrypt). If valid, return mapped `AppUser`.

After this, login and “current user” are fully driven by the database.

---

## 4. Dashboard data from enrollment_data.json only

Use **enrollment_data.json** as the single source for:

- Filter options (departments, programs, courses, instructors)
- Filtered list of enrollments
- Counts (e.g. unique students) per role

Apply role-based scoping **before** any other filters:

| Role        | Scope rule |
|------------|------------|
| **Dean**   | `FacId === staff.faculty_id` |
| **HoD**    | `DeptId ∈ staff.department_ids` (or `DeptCode` if you key by code; keep one convention) |
| **Instructor** | `Pernr === staff.pernr` |

Then apply the existing master filter (department, program, course, instructor) **within** that scope.

### 4.1 Dean

- **Filter options:** `getMasterFilterOptions(enrollmentRecords, staff.faculty_id, currentMasterFilter)`  
  So options are limited to faculty `staff.faculty_id` (FacId).
- **Filtered data:** `filterEnrollmentByMasterFilter(enrollmentRecords, masterFilter, staff.faculty_id)`  
  Same faculty_id.
- **Stats (departments, programs, instructors):** Use existing enrollment helpers with `facultyId = staff.faculty_id` and optional `departmentIds` from master filter.

No change to the enrollment helpers; just pass the dean’s `faculty_id` from the DB.

### 4.2 HoD

- **Scope:** Only enrollments where `DeptId` (or `DeptCode`) is in `staff.department_ids`.
- **Filter options:** First restrict enrollment to that scope, then call `getMasterFilterOptions(scopedRecords, undefined, currentMasterFilter)`. Alternatively, add a `departmentIds?: string[]` to the options helper and restrict departments to that set so dropdowns only show HoD’s departments.
- **Filtered data:** First scope by `staff.department_ids`, then `filterEnrollmentByMasterFilter(scopedRecords, masterFilter, undefined)`.
- **Stats:** Use the same enrollment stats functions on the scoped list (by department, program, instructor within those departments).

So: **scope by HoD’s departments once**, then reuse the same enrollment aggregation/filter logic.

### 4.3 Instructor

- **Scope:** Only enrollments where `Pernr === staff.pernr`.
- **Filter options:** Scope to `records.filter(r => r.Pernr === staff.pernr)`, then `getMasterFilterOptions(scopedRecords, undefined, currentMasterFilter)`. Options will only contain this instructor’s departments/programs/courses (and usually a single instructor).
- **Filtered data:** Scope by `staff.pernr`, then apply `filterEnrollmentByMasterFilter(scopedRecords, masterFilter, undefined)`.
- **Stats:** Same stats functions on the scoped list (one instructor, their courses/sections and student counts).

Instructor identity is **Pernr** from enrollment; no need to store `course_ids` in the DB for scope.

---

## 5. IDs and consistency

- **Faculty:** Use `FacId` from enrollment (e.g. `50000172`). Store in `staff.faculty_id` for Dean.
- **Department:** Use `DeptId` (e.g. `51517449`) in `departments.id` and `staff_departments.department_id`. In enrollment, filter with `r.DeptId === id` (and optionally `r.DeptCode` if you also store code). Keep one canonical id (e.g. DeptId) for APIs and DB.
- **Course:** Use `CrCode` (e.g. `LAW09208|11`) in filters and optional `courses` table.
- **Instructor:** Use `Pernr` (e.g. `00016932`) as the instructor key in enrollment and `staff.pernr` for the instructor role.

Then:

- **Dean** dashboard = all enrollment with that `FacId`.
- **HoD** dashboard = all enrollment with `DeptId` in their `staff_departments`.
- **Instructor** dashboard = all enrollment with that `Pernr`.

---

## 6. Optional: backfill faculties/departments from enrollment

To avoid maintaining faculties/departments by hand:

1. Scan `enrollment_data.json` for distinct `(FacId, DeptId, DeptCode, DeptName)` (and optionally faculty name from another source).
2. Insert into `faculties` and `departments`.
3. Re-run or extend the seed so staff rows reference these ids.

Same for **courses** if you use the `courses` table: distinct `CrCode` (and optionally `CrTitle`, `DeptId`, `FacId`) from enrollment.

---

## 7. Summary checklist

- [ ] Run `scripts/schema.sql` and replace placeholder password hashes.
- [ ] Implement DB load: staff by email → `AppUser` (with `department_ids` for HoD from `staff_departments`).
- [ ] Switch auth: `getCurrentUser` and `findUserByEmailAndPassword` use DB only.
- [ ] Ensure dashboard uses **enrollment_data.json** only:
  - **Dean:** pass `staff.faculty_id` into existing enrollment helpers.
  - **HoD:** scope enrollment by `staff.department_ids` (DeptId), then pass scoped list into same helpers.
  - **Instructor:** scope enrollment by `staff.pernr`, then pass scoped list into same helpers.
- [ ] (Optional) Backfill faculties/departments/courses from enrollment and point staff to them.

After this, role-based access is fully aligned with **enrollment_data.json** and database staff; **data.json** is no longer required for users or for building the dashboard.
