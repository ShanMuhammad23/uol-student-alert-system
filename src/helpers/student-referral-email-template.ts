export const STUDENT_REFERRAL_EMAIL_SUBJECT =
  "Referral of Student (SAP ID -----------) Case for Further Intervention";

export const STUDENT_REFERRAL_EMAIL_TEMPLATE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#f3f6fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#1f4a3d 0%,#2e6a58 100%);padding:18px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#ffffff;">
              Student Referral
            </p>
            <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#d8efe6;">
              Case for Further Intervention
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Dear [Counsellor's Name],
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              We are referring a student case (SAP ID ------) that requires intervention from experts. The details of all interventions carried out so far at faculty level are being shared for your reference.
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Kindly take up this case and proceed accordingly. Additionally, please update the case status on the portal, selecting the appropriate resolution option from the available dropdown.
            </p>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Please let us know if any further information is required.
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Warm regards,<br />
              [Sender Name]<br />
              [Designation]<br /><br />
              [Email]<br />
              [Department]<br />
              [Faculty]
            </p>
          </td>
        </tr>
      
      </table>
    </td>
  </tr>
</table>`;
