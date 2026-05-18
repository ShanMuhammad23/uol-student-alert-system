export type MissingAttendanceReminderRow = {
  instructorPernr: string;
  instructorName: string;
  instructorEmail: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  departmentId: string;
  departmentName: string;
  sectionCode: string;
  eventPackageId: string;
  studentsEnrolled: number;
  classesHeld: number;
  attendancePosted: number;
  missingEntries: number;
};
