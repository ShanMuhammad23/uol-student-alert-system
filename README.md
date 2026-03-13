### UNIVERSITY OF LAHORE - EARLY ALERT SYSTEM
Data Structure Usage Guide
File Location
/mnt/kimi/output/uol_early_alert_data.json
Data Structure Overview
1. METADATA
Contains system configuration and thresholds:
Attendance Warning: ≤ 40%
Attendance Critical: ≤ 20%
GPA Warning: Drop ≥ 1.0 points
GPA Critical: Drop ≥ 0.5 points
2. USERS (34 total)
Role-based access control:
Dean (1 user):
Email: dean@uol.edu.pk
Access: All faculties, all departments, all courses
View: Global dashboard with faculty breakdown
HoDs (3 users):
CS: hod.computer.science@uol.edu.pk
EE: hod.electrical.engineering@uol.edu.pk
BBA: hod.business.administration@uol.edu.pk
Access: Own department, all courses in department
View: Department dashboard + course breakdown
Teachers (30 users):
Access: Only assigned courses
View: Course-specific student lists with alerts
3. DASHBOARD DATA
Pre-calculated statistics for quick rendering:
Global Level (Dean):
JavaScript
Copy
data.dashboard_data.global.stats
// { total: 750, warning: 52, critical: 167, healthy: 531 }
Department Level (HoD):
JavaScript
Copy
data.dashboard_data.by_department[DEPT_ID].stats
Course Level (Teacher):
JavaScript
Copy
data.dashboard_data.by_department[DEPT_ID].courses[COURSE_ID].stats
4. ALERTS
Pre-filtered alert lists:
data.alerts.critical - All critical students
data.alerts.warning - All warning students
Individual student has overall_alert field
5. STUDENT RECORD STRUCTURE
JavaScript
Copy
{
  "id": "UOL20240001",
  "name": "Student 20240001",
  "email": "student20240001@uol.edu.pk",
  "course_id": "CS001",
  "department_id": "DEPT_001",
  "attendance": {
    "attended": 39,
    "total": 44,
    "rate": 0.89,
    "percentage": 89.0,
    "alert_level": null  // 'warning', 'critical', or null
  },
  "gpa": {
    "current": 4.0,
    "previous": 4.0,
    "change": 0.0,
    "trend": "stable",  // 'up', 'down', 'stable'
    "alert_level": null  // 'warning', 'critical', or null
  },
  "overall_alert": "none"  // 'warning', 'critical', or 'none'
}
Sample Implementation Logic
JavaScript
Copy
// 1. Login Simulation
function login(email) {
  const user = data.users.find(u => u.email === email);
  return user;
}

// 2. Get Dashboard Data Based on Role
function getDashboardData(user) {
  if (user.role === 'dean') {
    return data.dashboard_data.global;
  } else if (user.role === 'hod') {
    return data.dashboard_data.by_department[user.department];
  } else if (user.role === 'teacher') {
    const dept = user.department;
    const course = user.courses[0];
    return data.dashboard_data.by_department[dept].courses[course];
  }
}

// 3. Early Alert Tile Count
function getEarlyAlertCount(user) {
  const stats = getDashboardData(user).stats;
  return stats.warning + stats.critical; // Total vulnerable students
}

// 4. Generate Report
function generateReport(user) {
  const dashboard = getDashboardData(user);
  const students = getStudentsForUser(user);

  return students.map(s => ({
    student: s,
    comparison: {
      attendance_vs_class_avg: calculateClassAverage(s.course_id),
      gpa_trend: s.gpa.trend,
      deviation: checkThresholds(s)
    }
  }));
}
Demo Login Credentials
Dean: dean@uol.edu.pk / demo123
HoD CS: hod.computer.science@uol.edu.pk / demo123
HoD EE: hod.electrical.engineering@uol.edu.pk / demo123
HoD BBA: hod.business.administration@uol.edu.pk / demo123
Teacher: instructor1@uol.edu.pk / demo123 (Course CS001)
Key Features Supported
✅ Role-based dashboard rendering
✅ Early Alert tile with dynamic count
✅ Attendance vs Class Average comparison
✅ GPA trend analysis across semesters
✅ Threshold-based flagging (20%/40% attendance, 0.5/1.0 GPA)
✅ Three-level hierarchy: Faculty → Department → Course
✅ Pre-calculated statistics for instant rendering