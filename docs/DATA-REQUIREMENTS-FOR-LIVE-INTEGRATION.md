# Data Requirements for Live University Server Integration

**To:** Management / University IT / Data Owners  
**Subject:** Data requirements for Student Early Alert Portal – live integration from university server  
**Purpose:** Specify all data fields and formats needed to connect the portal to live university systems.

---

## 1. Overview

The **Student Early Alert Portal** helps Deans, Heads of Department (HoD), and Instructors identify at-risk students using **attendance** and **GPA** alerts, and track **interventions**. To run on **live data** from the university server, the following entities and fields must be available (via API, database view, or secure file export).

---

## 2. Required Data Entities & Fields

### 2.1 Faculties

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `id`        | string | Yes      | Unique faculty identifier (e.g. `FAC_ENG`) |
| `name`      | string | Yes      | Faculty name (e.g. "Faculty of Engineering & Technology") |

**Usage:** Dean-level scope; dashboard heading and filters.

---

### 2.2 Departments

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `id`           | string | Yes      | Unique department identifier (e.g. `DEPT_CS`) |
| `name`         | string | Yes      | Department name |
| `faculty_id`   | string | Yes      | ID of the parent faculty (links to Faculties) |

**Usage:** Hierarchy (Faculty → Department); HoD and Dean filters; grouping in nested views.

---

### 2.3 Courses

| Field              | Type   | Required | Description |
|--------------------|--------|----------|-------------|
| `id`               | string | Yes      | Unique course identifier (e.g. `CS101`). Used to derive *program* (e.g. CS, EE) from prefix. |
| `name`             | string | Yes      | Course title |
| `department_id`    | string | Yes      | ID of the department offering the course |
| `faculty_id`       | string | Yes      | ID of the faculty (for filtering) |
| `total_classes_held` | number | Yes   | Total number of classes held in the current semester (for attendance %) |
| `credit_hours`     | number | Yes      | Course credit hours |
| `semester`         | string | Yes      | Current semester label (e.g. "Fall 2024") |

**Usage:** Student–course assignment; instructor–course assignment; program derived from course ID prefix; class size and attendance context.

---

### 2.4 Users (Portal roles: Dean, HoD, Teacher)

| Field            | Type     | Required | Description |
|------------------|----------|----------|-------------|
| `id`             | string   | Yes      | Unique user identifier |
| `sap_id`         | string   | Optional | Staff SAP ID (for display/audit) |
| `name`           | string   | Yes      | Full name |
| `email`          | string   | Yes      | Login email (used for authentication) |
| `role`           | string   | Yes      | One of: `dean`, `hod`, `teacher` |
| `faculty_id`     | string   | Conditional | Required for **dean** and **teacher**. Links dean to faculties, teacher to faculty. |
| `department_id`  | string   | Conditional | Required for **teacher**. Department the instructor belongs to. |
| `department_ids` | string[] | Conditional | Required for **hod**. List of department IDs the HoD is responsible for. |
| `course_ids`     | string[] | Conditional | Required for **teacher**. List of course IDs the instructor teaches. Can be empty. |

**Role rules:**
- **Dean:** `role = "dean"`, `faculty_id` set; `department_id` and `course_ids` typically null.
- **HoD:** `role = "hod"`, `department_ids` = array of department IDs; `faculty_id` and `course_ids` typically null.
- **Teacher:** `role = "teacher"`, `faculty_id`, `department_id`, and `course_ids` (courses they teach) set.

**Usage:** Access control; dashboard scope (Dean → faculties, HoD → departments, Teacher → their courses); filter options (instructors list).

---

### 2.5 Students (core entity for alerts)

Each record represents a **student in a specific course** (one row per student–course enrollment for the current semester).

| Field | Type | Required | Description |
|-------|-----|----------|-------------|
| `sap_id` | string | Yes | Student SAP ID (unique per student; used for profile and intervention linking) |
| `name` | string | Yes | Student full name |
| `course_id` | string | Yes | Course ID (must exist in Courses) |
| `department_id` | string | Yes | Department ID (must exist in Departments) |
| `faculty_id` | string | Yes | Faculty ID (must exist in Faculties) |
| **Attendance (nested object)** | | | |
| `attendance.total_classes_held` | number | Yes | Total classes held for this course (should match course or section) |
| `attendance.classes_attended` | number | Yes | Number of classes the student attended |
| `attendance.attendance_percentage` | number | Yes | Percentage (e.g. 0–100). Can be derived as `(classes_attended / total_classes_held) * 100` if not provided. |
| `attendance.class_average_attendance` | number | Yes | Class/section average attendance % (for comparison on profile) |
| `attendance.deviation_from_class_avg` | number | Yes | Student % minus class average (for reporting) |
| `attendance.alert_level` | string \| null | Optional | `"critical"` \| `"warning"` \| `null`. If not provided, portal can derive from thresholds (see §3). |
| `attendance.total_students_in_class` | number | Optional | Class size (for reports) |
| **GPA (nested object)** | | | |
| `gpa.history` | array | Yes | List of past semesters: `{ semester: string, gpa: number, credit_hours: number }` |
| `gpa.current` | number | Yes | Current semester GPA |
| `gpa.previous` | number | Yes | Previous semester GPA |
| `gpa.change` | number | Yes | Current − previous (positive = improvement) |
| `gpa.trend` | string | Yes | One of: `"up"`, `"down"`, `"stable"` |
| `gpa.class_average_gpa_current` | number | Yes | Class/section average GPA (current) |
| `gpa.class_average_gpa_previous` | number | Yes | Class/section average GPA (previous) |
| `gpa.alert_level` | string \| null | Optional | `"critical"` \| `"warning"` \| `null`. If not provided, portal derives from drop thresholds (see §3). |
| `gpa.total_students_in_class` | number | Optional | Class size (for reports) |
| **Overall** | | | |
| `overall_alert` | string | Optional | `"critical"` \| `"warning"` \| `"none"`. If not provided, portal derives from GPA and attendance alert levels. |

**Usage:** Dashboards (counts, filters, tables); student profile; alert reports; intervention linking by `sap_id`.

---

## 3. Alert Thresholds (configurable)

The portal uses the following rules when `alert_level` is not supplied by the server. University can either supply pre-computed `alert_level` or let the portal compute using these (or institution-specific) values.

| Dimension   | Warning (yellow)     | Critical (red)      |
|------------|----------------------|----------------------|
| Attendance | ≤ 40%                | ≤ 20%                |
| GPA        | Drop ≥ 0.5 from previous semester | Drop ≥ 1.0 from previous semester |

These can be stored in a small config/metadata payload (e.g. `metadata.thresholds`) if the university wants to override defaults.

---

## 4. Optional: Intervention / Outreach Records

The portal currently stores **intervention records** locally (outreach mode, date, remarks, status). For a live setup, these can either:

- Remain in the portal only, or  
- Be supplied/synced from the university (e.g. CRM or student support system).

If the university will supply or sync interventions, each record should include at least:

| Field | Type | Description |
|-------|-----|-------------|
| `id` | string | Unique record ID |
| `student_sap_id` | string | Links to Students |
| `date` | string | YYYY-MM-DD |
| `outreach_mode` | string | e.g. email, phone-call, meeting |
| `remarks` | string | Notes |
| `status` | string | e.g. initiated, in-progress, referred, resolved |
| `performed_at` | string | ISO date-time |

---

## 5. Data Format & Delivery

- **Format:** JSON (or API responses that map to the structures above). CSV/Excel can be supported if mapped to these field names.
- **Refresh:** Recommended at least daily (or real-time via secure API) so alerts and lists stay current.
- **Security:** Data must be transferred and stored per university security and privacy policy (e.g. encrypted, access-controlled, audit logs). Only authorized roles (Dean, HoD, Teacher) should see data scoped to their faculties/departments/courses.
- **Identifiers:** Use stable IDs (`id`, `sap_id`, `course_id`, `department_id`, `faculty_id`) so that exports/APIs are consistent across refreshes and student/instructor/course records can be matched.

---

## 6. Summary Checklist

| # | Entity      | Key fields to provide |
|---|-------------|------------------------|
| 1 | Faculties   | id, name |
| 2 | Departments | id, name, faculty_id |
| 3 | Courses     | id, name, department_id, faculty_id, total_classes_held, credit_hours, semester |
| 4 | Users       | id, name, email, role, faculty_id / department_id / department_ids, course_ids (per role) |
| 5 | Students    | sap_id, name, course_id, department_id, faculty_id; attendance (totals, %, class average, deviation); gpa (history, current, previous, change, trend, class averages); optional alert_level and overall_alert |

If you need a sample JSON file or an API specification (e.g. OpenAPI) aligned to these structures, we can provide that as a follow-up.

---

**Contact:** [Your name/team]  
**Document version:** 1.0  
**Last updated:** [Date]
