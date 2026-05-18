export type MissingAttendanceEmailVars = {
  instructorName: string;
  courseName: string;
  courseCode: string;
  department: string;
  studentsEnrolled: number;
  classesHeld: number;
  attendancePosted: number;
  missingEntries: number;
};

export const MISSING_ATTENDANCE_EMAIL_SUBJECT =
  "Reminder: Missing Attendance Records — [Course Code]";

export const MISSING_ATTENDANCE_EMAIL_TEMPLATE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#f3f6fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#1f4a3d 0%,#2e6a58 100%);padding:18px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#ffffff;">
              Missing Attendance Records
            </p>
            <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#d8efe6;">
              Formal reminder for the current semester
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Dear [Instructor Name],
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              I hope this message finds you well. This is a formal reminder regarding the missing attendance records for the below course assigned to you this semester:
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:10px;background-color:#f8fbff;">
              <tr>
                <td style="padding:14px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Course Name:</strong> [Course Name]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Course Code:</strong> [Course Code]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Department:</strong> [Department]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Students Enrolled:</strong> [No. of Students]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Classes Held:</strong> [No. of Classes Held]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Attendance Posted:</strong> [No. of Classes with Attendance Posted]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Missing Entries:</strong> [No. of Missing Entries]</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Accurate and timely attendance records are a critical component of academic compliance and student monitoring. Incomplete records can affect student eligibility, financial aid assessments, and departmental reporting.
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              You are kindly requested to update the missing attendance entries no later than tomorrow.
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Should you have already submitted the attendance, or if exceptional circumstances are preventing timely submission, please respond to this email with the relevant details.
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              For any technical difficulties accessing the portal, please contact <br/>
              <strong>
              Shan Muhammad <br/>
              Web Developer <br/>
              SPMO - The University of Lahore <br/>
              shan.muhammad@spmo.uol.edu.pk <br/> 
             Cell:  03219720819 <br/>
             </strong>
            </p>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Your prompt attention to this matter is greatly appreciated.
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Warm regards,<br /><br />
              Office of Dean,<br />
              Faculty of Social Sciences<br />
              The University of Lahore
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMissingAttendanceEmailSubject(courseCode: string): string {
  return MISSING_ATTENDANCE_EMAIL_SUBJECT.replace(
    "[Course Code]",
    courseCode.trim() || "Course"
  );
}

export function buildMissingAttendanceEmailHtml(
  vars: MissingAttendanceEmailVars
): string {
  const instructorName = escapeHtml(vars.instructorName.trim() || "Instructor");
  const courseName = escapeHtml(vars.courseName.trim() || "—");
  const courseCode = escapeHtml(vars.courseCode.trim() || "—");
  const department = escapeHtml(vars.department.trim() || "—");
  const studentsEnrolled = String(Math.max(0, vars.studentsEnrolled));
  const classesHeld = String(Math.max(0, vars.classesHeld));
  const attendancePosted = String(Math.max(0, vars.attendancePosted));
  const missingEntries = String(Math.max(0, vars.missingEntries));

  return MISSING_ATTENDANCE_EMAIL_TEMPLATE.replace(
    "[Instructor Name]",
    instructorName
  )
    .replace("[Course Name]", courseName)
    .replace("[Course Code]", courseCode)
    .replace("[Department]", department)
    .replace("[No. of Students]", studentsEnrolled)
    .replace("[No. of Classes Held]", classesHeld)
    .replace(
      "[No. of Classes with Attendance Posted]",
      attendancePosted
    )
    .replace("[No. of Missing Entries]", missingEntries);
}
