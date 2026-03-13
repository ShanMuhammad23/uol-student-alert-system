const fs = require("fs");
const path = require("path");

const courseIds = [
  "CS101", "CS102", "CS103", "CS104", "CS105",
  "EE101", "EE102", "EE103", "EE104", "EE105",
  "BBA101", "BBA102", "BBA103", "BBA104", "BBA105",
  "SE101", "SE102", "SE103", "SE104", "SE105",
  "MECH101", "MECH102", "MECH103", "MECH104", "MECH105",
  "CIVIL101", "CIVIL102", "CIVIL103", "CIVIL104", "CIVIL105"
];

const deptByCourse = {
  CS101: "DEPT_CS", CS102: "DEPT_CS", CS103: "DEPT_CS", CS104: "DEPT_CS", CS105: "DEPT_CS",
  EE101: "DEPT_EE", EE102: "DEPT_EE", EE103: "DEPT_EE", EE104: "DEPT_EE", EE105: "DEPT_EE",
  BBA101: "DEPT_BBA", BBA102: "DEPT_BBA", BBA103: "DEPT_BBA", BBA104: "DEPT_BBA", BBA105: "DEPT_BBA",
  SE101: "DEPT_SE", SE102: "DEPT_SE", SE103: "DEPT_SE", SE104: "DEPT_SE", SE105: "DEPT_SE",
  MECH101: "DEPT_MECH", MECH102: "DEPT_MECH", MECH103: "DEPT_MECH", MECH104: "DEPT_MECH", MECH105: "DEPT_MECH",
  CIVIL101: "DEPT_CIVIL", CIVIL102: "DEPT_CIVIL", CIVIL103: "DEPT_CIVIL", CIVIL104: "DEPT_CIVIL", CIVIL105: "DEPT_CIVIL"
};

function getOverallAlert(attendanceAlert, gpaAlert) {
  if (attendanceAlert === "critical" || gpaAlert === "critical") return "critical";
  if (attendanceAlert === "warning" || gpaAlert === "warning") return "warning";
  return "none";
}

let sid = 20240001;
const students = [];
const criticalIds = [];
const warningIds = [];

courseIds.forEach((courseId) => {
  const deptId = deptByCourse[courseId];
  const totalSessions = 44;
  for (let i = 0; i < 10; i++) {
    const id = "UOL" + sid;
    const name = "Student " + sid;
    const email = "student" + sid + "@uol.edu.pk";

    let attended, pct, attendanceAlert;
    if (i === 0) {
      attended = Math.floor(totalSessions * 0.15);
      pct = Math.round((attended / totalSessions) * 100);
      attendanceAlert = "critical";
    } else if (i === 1) {
      attended = Math.floor(totalSessions * 0.35);
      pct = Math.round((attended / totalSessions) * 100);
      attendanceAlert = "warning";
    } else {
      attended = Math.floor(totalSessions * (0.6 + Math.random() * 0.35));
      pct = Math.round((attended / totalSessions) * 100);
      attendanceAlert = pct <= 20 ? "critical" : pct <= 40 ? "warning" : null;
    }

    const prevGpa = 2.5 + Math.random() * 1.5;
    let change, currentGpa, gpaTrend, gpaAlert;
    if (i === 0) {
      change = -0.8;
      currentGpa = Math.round((prevGpa + change) * 10) / 10;
      gpaTrend = "down";
      gpaAlert = "critical";
    } else if (i === 2) {
      change = -1.2;
      currentGpa = Math.round((prevGpa + change) * 10) / 10;
      gpaTrend = "down";
      gpaAlert = "warning";
    } else {
      change = Math.round((Math.random() - 0.4) * 0.8 * 100) / 100;
      currentGpa = Math.round((prevGpa + change) * 10) / 10;
      gpaTrend = change > 0.1 ? "up" : change < -0.1 ? "down" : "stable";
      gpaAlert = change <= -0.5 ? "critical" : change <= -1.0 ? "warning" : null;
    }

    const overallAlert = getOverallAlert(attendanceAlert, gpaAlert);
    if (overallAlert === "critical") criticalIds.push(id);
    else if (overallAlert === "warning") warningIds.push(id);

    students.push({
      id,
      name,
      email,
      course_id: courseId,
      department_id: deptId,
      attendance: {
        attended,
        total: totalSessions,
        rate: Math.round((attended / totalSessions) * 100) / 100,
        percentage: pct,
        alert_level: attendanceAlert
      },
      gpa: {
        current: currentGpa,
        previous: Math.round(prevGpa * 10) / 10,
        change,
        trend: gpaTrend,
        alert_level: gpaAlert
      },
      overall_alert: overallAlert
    });
    sid++;
  }
});

function buildStats(studentList) {
  const total = studentList.length;
  let critical = 0, warning = 0;
  studentList.forEach((s) => {
    if (s.overall_alert === "critical") critical++;
    else if (s.overall_alert === "warning") warning++;
  });
  return { total, warning, critical, healthy: total - warning - critical };
}

const byDepartment = {};
const byCourse = {};
courseIds.forEach((cid) => {
  const deptId = deptByCourse[cid];
  const courseStudents = students.filter((s) => s.course_id === cid);
  const stats = buildStats(courseStudents);
  const classAvgAttendance = courseStudents.length
    ? courseStudents.reduce((a, s) => a + s.attendance.percentage, 0) / courseStudents.length
    : 0;
  if (!byDepartment[deptId]) {
    byDepartment[deptId] = { stats: { total: 0, warning: 0, critical: 0, healthy: 0 }, courses: {} };
  }
  byDepartment[deptId].courses[cid] = {
    stats,
    class_avg_attendance: Math.round(classAvgAttendance * 10) / 10
  };
  byDepartment[deptId].stats.total += stats.total;
  byDepartment[deptId].stats.warning += stats.warning;
  byDepartment[deptId].stats.critical += stats.critical;
  byDepartment[deptId].stats.healthy += stats.healthy;
});

const globalStats = buildStats(students);

const dashboard_data = {
  global: {
    stats: globalStats,
    by_faculty: {
      FAC_ENG: buildStats(students.filter((s) => ["DEPT_CS", "DEPT_EE", "DEPT_SE", "DEPT_MECH", "DEPT_CIVIL"].includes(s.department_id))),
      FAC_MGT: buildStats(students.filter((s) => s.department_id === "DEPT_BBA"))
    }
  },
  by_department: byDepartment
};

const alerts = {
  critical: criticalIds,
  warning: warningIds
};

const dataPath = path.join(__dirname, "..", "public", "data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
data.students = students;
data.dashboard_data = dashboard_data;
data.alerts = alerts;
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");
console.log("Generated", students.length, "students. Critical:", criticalIds.length, "Warning:", warningIds.length);
console.log("dashboard_data and alerts written to public/data.json");
