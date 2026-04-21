export const SOS_CHECK_IN_EMAIL_SUBJECT = "SOS Check-In - Attendance and Academic Progress";

export const SOS_CHECK_IN_EMAIL_TEMPLATE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#f3f6fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#1f4a3d 0%,#2e6a58 100%);padding:18px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#ffffff;">
              SOS Check-In
            </p>
            <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#d8efe6;">
              Attendance and Academic Progress
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Dear [Student Name],
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              I hope you are doing well. I am writing to check in, as we have noticed a decline in your attendance and/or academic performance. We wanted to reach out to ensure that everything is alright.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:10px;background-color:#f8fbff;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;font-weight:700;color:#1f4a3d;">
                    For your reference:
                  </p>
                  <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    Attendance: ___%
                  </p>
                  <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    Course: [Focused Course Title] ([Focused Class Type])
                  </p>
                  <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    Previous SGPA: ___; Current SGPA: ___; Drop ____
                  </p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    Previous CGPA: ___; Current CGPA: ___; Drop ____
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              This message is not related to any disciplinary matter. Our concern is solely for your well-being and to understand if you might be facing any academic, personal, or health-related challenges that may be affecting your studies. If there is anything you would like to share, or if you feel you would benefit from support or guidance, we are here to listen and assist.
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              You may also let us know if you would like to speak with a counsellor or receive support confidentially.
            </p>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Wishing you well, and we look forward to hearing from you.
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Warm regards,<br />
              [Sender Name]<br />
              [Designation]<br />
               [Department] <br />
              [Faculty]
            </p>
          </td>
        </tr>
        
      </table>
    </td>
  </tr>
</table>`;
