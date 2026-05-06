"use client";

import React, { useEffect, useId, useState } from "react";
import { ChevronUpIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import {
  SOS_CHECK_IN_EMAIL_SUBJECT,
  SOS_CHECK_IN_EMAIL_TEMPLATE,
} from "@/helpers/sos-check-in-email-template";
import {
  STUDENT_REFERRAL_EMAIL_SUBJECT,
  STUDENT_REFERRAL_EMAIL_TEMPLATE,
} from "@/helpers/student-referral-email-template";

const OUTREACH_MODES = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone-call", label: "Phone Call" },
  { value: "meeting", label: "Meeting" },
  { value: "not-applicable", label: "Not Applicable" }
] as const;

const STATUS_OPTIONS = [
  { value: "initiated", label: "Initiated" },
  { value: "in-progress", label: "In-Progress" },
  { value: "referred", label: "Referred" },
  { value: "resolved", label: "Resolved" },
  { value: "no-action-required", label: "No Action Required" },
] as const;

const TYPE_OPTIONS = [
  { value: "attendance", label: "Attendance" },
  { value: "gpa", label: "SGPA" },
  { value: "both", label: "Both" }
] as const;

export type InterventionFormData = {
  date: string;
  interventionType: "attendance" | "gpa" | "both";
  outreachMode: string;
  remarks: string;
  status: string;
};

export type InterventionEmailTemplateKey = "sos_check_in" | "student_referral";

export type InterventionEmailData = {
  templateKey: InterventionEmailTemplateKey;
  recipientEmail: string;
  replyToEmail: string;
  subject: string;
  bodyHtml: string;
};

type InterventionFormProps = {
  onSubmit?: (data: InterventionFormData) => Promise<void> | void;
  onSendEmail?: (data: InterventionEmailData) => Promise<void> | void;
  onCancel?: () => void;
  className?: string;
  studentSapId?: string;
  studentName?: string | null;
  attendancePercent?: number | null;
  attendanceAlertLevel?: "warning" | "critical" | null;
  gpaPrevious?: number | null;
  gpaCurrent?: number | null;
  gpaDrop?: number | null;
  cgpaPrevious?: number | null;
  cgpaCurrent?: number | null;
  cgpaDrop?: number | null;
  senderName?: string | null;
  senderDesignation?: string | null;
  senderDepartment?: string | null;
  senderFaculty?: string | null;
  senderEmail?: string | null;
  wellbeingCounsellorEmailOptions?: { id: string; name: string; email: string }[];
  focusedCourseTitle?: string | null;
  focusedClassType?: string | null;
  mode?: "intervention" | "wellbeing";
};

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  items,
  required,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  items: { value: string; label: string }[];
  required?: boolean;
  id: string;
}) {
  const isSelected = value !== "";
  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="block text-body-sm font-medium text-dark dark:text-white"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={cn(
            "w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary [&>option]:text-dark-5 dark:[&>option]:text-dark-6",
            isSelected && "text-dark dark:text-white",
          )}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronUpIcon className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rotate-180" />
      </div>
    </div>
  );
}

const InterventionForm = ({
  onSubmit,
  onSendEmail,
  onCancel,
  className,
  studentSapId,
  studentName,
  attendancePercent,
  attendanceAlertLevel,
  gpaPrevious,
  gpaCurrent,
  gpaDrop,
  cgpaPrevious,
  cgpaCurrent,
  cgpaDrop,
  senderName,
  senderDesignation,
  senderDepartment,
  senderFaculty,
  senderEmail,
  wellbeingCounsellorEmailOptions = [],
  focusedCourseTitle,
  focusedClassType,
  mode = "intervention",
}: InterventionFormProps) => {
  const dateId = useId();
  const outreachId = useId();
  const typeId = useId();
  const statusId = useId();

  const [date, setDate] = useState("");
  const [outreachMode, setOutreachMode] = useState("");
  const [interventionType, setInterventionType] = useState<"attendance" | "gpa" | "both">("attendance");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailTemplateKey, setEmailTemplateKey] =
    useState<InterventionEmailTemplateKey | "">("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState(senderEmail?.trim() ?? "");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBodyHtml, setEmailBodyHtml] = useState("");
  const [submitMessage, setSubmitMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const shouldShowEmailSection =
    mode === "intervention" && outreachMode === "email";
  const canUseSosTemplate = status === "initiated" && outreachMode === "email";
  const canUseReferralTemplate = status === "referred";

  const getSosSubjectByType = (
    type: "attendance" | "gpa" | "both"
  ): string => {
    if (type === "attendance") {
      return "SOS Check-In - Academic Progress(Attendance)";
    }
    if (type === "gpa") {
      return "SOS Check-In - Academic Progress (SGPA)";
    }
    return "SOS Check-In - Attendance and Academic Progress";
  };

  const getSosSubtitleByType = (
    type: "attendance" | "gpa" | "both"
  ): string => {
    if (type === "attendance") return "Academic Progress (Attendance)";
    if (type === "gpa") return "Academic Progress (SGPA)";
    return "Attendance and Academic Progress";
  };

  useEffect(() => {
    if (!shouldShowEmailSection && emailTemplateKey) {
      setEmailTemplateKey("");
      setEmailSubject("");
      setEmailBodyHtml("");
    }
  }, [shouldShowEmailSection, emailTemplateKey]);

  useEffect(() => {
    if (emailTemplateKey === "student_referral" && !canUseReferralTemplate) {
      setEmailTemplateKey("");
      setEmailSubject("");
      setEmailBodyHtml("");
    }
    if (emailTemplateKey === "sos_check_in" && !canUseSosTemplate) {
      setEmailTemplateKey("");
      setEmailSubject("");
      setEmailBodyHtml("");
    }
  }, [emailTemplateKey, canUseReferralTemplate, canUseSosTemplate]);

  useEffect(() => {
    if (!replyToEmail.trim() && senderEmail?.trim()) {
      setReplyToEmail(senderEmail.trim());
    }
  }, [senderEmail, replyToEmail]);

  useEffect(() => {
    if (!shouldShowEmailSection) return;
    if (emailTemplateKey) return;
    if (canUseSosTemplate) {
      handleSelectTemplate("sos_check_in");
      return;
    }
    if (canUseReferralTemplate) {
      handleSelectTemplate("student_referral");
    }
  }, [
    shouldShowEmailSection,
    emailTemplateKey,
    canUseSosTemplate,
    canUseReferralTemplate,
  ]);

  const fillTemplateWithData = (
    templateKey: InterventionEmailTemplateKey,
    subject: string,
    body: string
  ): { subject: string; body: string } => {
    const formatGpa = (value: number | null | undefined): string =>
      typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "N/A";
    const studentDisplay = studentName?.trim() || "Student";
    const sap = studentSapId ?? "N/A";
    const attendanceText =
      attendancePercent == null || !Number.isFinite(attendancePercent)
        ? "N/A"
        : `${attendancePercent.toFixed(1)}%`;
    const attendanceColor =
      attendanceAlertLevel === "critical"
        ? "#DC2626"
        : attendanceAlertLevel === "warning"
          ? "#D97706"
          : "#374151";
    const attendanceHtml = `<span style="font-weight:700;color:${attendanceColor};">${attendanceText}</span>`;
    const gpaPrevText = formatGpa(gpaPrevious);
    const gpaCurrentText =
      gpaCurrent == null || !Number.isFinite(gpaCurrent) ? "N/A" : gpaCurrent.toFixed(2);
    const gpaDropText = formatGpa(
      typeof gpaDrop === "number" && Number.isFinite(gpaDrop) ? Math.abs(gpaDrop) : gpaDrop
    );
    const cgpaPrevText = formatGpa(cgpaPrevious);
    const cgpaCurrentText =
      cgpaCurrent == null || !Number.isFinite(cgpaCurrent) ? "N/A" : cgpaCurrent.toFixed(2);
    const cgpaDropText = formatGpa(
      typeof cgpaDrop === "number" && Number.isFinite(cgpaDrop) ? Math.abs(cgpaDrop) : cgpaDrop
    );
    const sgpaDelta =
      typeof gpaCurrent === "number" &&
      Number.isFinite(gpaCurrent) &&
      typeof gpaPrevious === "number" &&
      Number.isFinite(gpaPrevious)
        ? gpaCurrent - gpaPrevious
        : null;
    const cgpaDelta =
      typeof cgpaCurrent === "number" &&
      Number.isFinite(cgpaCurrent) &&
      typeof cgpaPrevious === "number" &&
      Number.isFinite(cgpaPrevious)
        ? cgpaCurrent - cgpaPrevious
        : null;
    const formatSigned = (value: number) =>
      `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
    const buildTrendHtml = (delta: number | null) => {
      if (delta == null) return "Trend N/A";
      if (delta > 0) {
        return `<span style="font-weight:700;color:#15803D;">Up ${formatSigned(delta)}</span>`;
      }
      if (delta < 0) {
        return `<span style="font-weight:700;color:#DC2626;">Drop ${Math.abs(delta).toFixed(2)}</span>`;
      }
      return `<span style="font-weight:700;color:#374151;">No change</span>`;
    };
    const sgpaTrendHtml = buildTrendHtml(sgpaDelta);
    const cgpaTrendHtml = buildTrendHtml(cgpaDelta);
    const senderNameText = senderName?.trim() || "N/A";
    const senderDesignationText = senderDesignation?.trim() || "N/A";
    const senderDepartmentText = senderDepartment?.trim() || "N/A";
    const senderFacultyText = senderFaculty?.trim() || "N/A";
    const senderEmailText = senderEmail?.trim() || "N/A";
    const focusedCourseTitleText = focusedCourseTitle?.trim() || "N/A";
    const focusedClassTypeText = focusedClassType?.trim() || "N/A";
    const referenceLines: string[] = [];
    if (interventionType === "attendance" || interventionType === "both") {
      referenceLines.push(
        `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">Attendance: ${attendanceHtml}</p>`
      );
      referenceLines.push(
        `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">Course: ${focusedCourseTitleText} (${focusedClassTypeText})</p>`
      );
    }
    if (interventionType === "gpa" || interventionType === "both") {
      referenceLines.push(
        `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">Previous SGPA: ${gpaPrevText}; Current SGPA: ${gpaCurrentText}; ${sgpaTrendHtml}</p>`
      );
      referenceLines.push(
        `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">Previous CGPA: ${cgpaPrevText}; Current CGPA: ${cgpaCurrentText}; ${cgpaTrendHtml}</p>`
      );
    }

    const subjectBase =
      templateKey === "sos_check_in"
        ? getSosSubjectByType(interventionType)
        : subject;
    const nextSubject = subjectBase.replace(
      "(SAP ID -----------)",
      `(SAP ID ${sap})`
    );

    const nextBodyRaw = body
      .replace("[Student Name]", studentDisplay)
      .replace("SAP ID ------", `SAP ID ${sap}`)
      .replace("[Sender Name]", senderNameText)
      .replace("[Designation]", senderDesignationText)
      .replace("[Department]", senderDepartmentText)
      .replace("[Faculty]", senderFacultyText)
      .replace(
        "[Department/Faculty Name]",
        `${senderDepartmentText} - ${senderFacultyText}`
      )
      .replace("[Email]", senderEmailText)
      .replace("[Focused Course Title]", focusedCourseTitleText)
      .replace("[Focused Class Type]", focusedClassTypeText)
      .replace("[Counsellor's Name]", "Counsellor")
      .replace(/\[sap_id\]/gi, sap)
      .replace(/\[student email\]/gi, `${sap}@student.uol.edu.pk`)
      .replace(/___%/g, attendanceText)
      .replace(/____/g, gpaDropText);

    const nextBody =
      templateKey === "sos_check_in"
        ? nextBodyRaw
            .replace(
              "Attendance and Academic Progress",
              getSosSubtitleByType(interventionType)
            )
            .replace("[REFERENCE_BLOCK]", referenceLines.join(""))
        : nextBodyRaw;

    return { subject: nextSubject, body: nextBody };
  };

  const handleSelectTemplate = (key: InterventionEmailTemplateKey) => {
    setEmailTemplateKey(key);
    if (key === "sos_check_in") {
      const sap = String(studentSapId ?? "").trim();
      if (sap) {
        setRecipientEmail(`${sap}@student.uol.edu.pk`);
      }
      setReplyToEmail(senderEmail?.trim() ?? "");
      const t = fillTemplateWithData(
        "sos_check_in",
        SOS_CHECK_IN_EMAIL_SUBJECT,
        SOS_CHECK_IN_EMAIL_TEMPLATE
      );
      setEmailSubject(t.subject);
      setEmailBodyHtml(t.body);
      return;
    }
    setRecipientEmail("");
    setReplyToEmail(senderEmail?.trim() ?? "");
    const t = fillTemplateWithData(
      "student_referral",
      STUDENT_REFERRAL_EMAIL_SUBJECT,
      STUDENT_REFERRAL_EMAIL_TEMPLATE
    );
    setEmailSubject(t.subject);
    setEmailBodyHtml(t.body);
  };

  const showReferralRecipientDropdown = emailTemplateKey === "student_referral";

  useEffect(() => {
    if (emailTemplateKey !== "sos_check_in") return;
    const t = fillTemplateWithData(
      "sos_check_in",
      SOS_CHECK_IN_EMAIL_SUBJECT,
      SOS_CHECK_IN_EMAIL_TEMPLATE
    );
    setEmailSubject(t.subject);
    setEmailBodyHtml(t.body);
  }, [interventionType]);

  const resetForm = () => {
    setDate("");
    setOutreachMode("");
    setInterventionType("attendance");
    setRemarks("");
    setStatus("");
    setEmailTemplateKey("");
    setRecipientEmail("");
    setReplyToEmail(senderEmail?.trim() ?? "");
    setEmailSubject("");
    setEmailBodyHtml("");
    setSubmitMessage(null);
    setIsAdding(false);
    setIsSendingEmail(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;
    setSubmitMessage(null);
    setIsAdding(true);
    try {
      if (shouldShowEmailSection) {
        if (!emailTemplateKey) {
          throw new Error("Select an email template to continue.");
        }
        if (!recipientEmail.trim()) {
          throw new Error("Recipient email is required to send email.");
        }
        if (!replyToEmail.trim()) {
          throw new Error("Reply-To email is required to send email.");
        }
      }

      await onSubmit({
        date,
        interventionType,
        outreachMode,
        remarks,
        status,
      });

      if (shouldShowEmailSection && onSendEmail && emailTemplateKey) {
        setIsSendingEmail(true);
        await onSendEmail({
          templateKey: emailTemplateKey,
          recipientEmail: recipientEmail.trim(),
          replyToEmail: replyToEmail.trim(),
          subject: emailSubject.trim(),
          bodyHtml: emailBodyHtml.trim(),
        });
      }

      setSubmitMessage({ type: "success", text: "Intervention added successfully." });
      if (onCancel) onCancel();
    } catch (err) {
      setSubmitMessage({
        type: "error",
        text:
          err instanceof Error && err.message
            ? err.message
            : "Failed to add intervention. Please try again.",
      });
    } finally {
      setIsAdding(false);
      setIsSendingEmail(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-5", className)}>
      {/* 1. Date */}
      <div>
        <label
          htmlFor={dateId}
          className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
        >
          Date
        </label>
        <input
          id={dateId}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary active:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
        />
      </div>

      {/* 2. Type */}
      <div className="space-y-3">
        <label
          htmlFor={typeId}
          className="block text-body-sm font-medium text-dark dark:text-white"
        >
          Type
        </label>
        <div id={typeId} className="flex flex-wrap items-center gap-4">
          {TYPE_OPTIONS.map((t) => (
            <label
              key={t.value}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-dark dark:text-white"
            >
              <input
                type="radio"
                name="interventionType"
                value={t.value}
                checked={interventionType === t.value}
                onChange={() => setInterventionType(t.value)}
                className="h-4 w-4 accent-primary"
              />
              {t.label}
            </label>
          ))}
        </div>
        {mode === "wellbeing" && (
          <p className="text-xs text-dark-6 dark:text-white">
            In wellbeing mode, selected type maps to wellbeing category.
          </p>
        )}
      </div>

      {/* 3. Status */}
      <SelectField
        id={statusId}
        label="Status"
        placeholder="Select status"
        value={status}
        onChange={setStatus}
        items={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        required
      />

      {/* 4. Mode */}
      {mode === "intervention" ? (
        <SelectField
          id={outreachId}
          label="Mode"
          placeholder="Select mode"
          value={outreachMode}
          onChange={setOutreachMode}
          items={OUTREACH_MODES.map((o) => ({ value: o.value, label: o.label }))}
          required
        />
      ) : (
        <div className="rounded-lg border border-stroke p-3 text-sm text-dark-6 dark:border-dark-3 dark:text-white">
          Wellbeing case will be stored in wellbeing resolution records.
        </div>
      )}

      {/* 5. Remarks */}
      <div>
        <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
          Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          placeholder="Enter remarks..."
          className="w-full overflow-y-auto rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary placeholder:text-dark-6"
        />
      </div>

      {/* 6. Email Section (reserved space to avoid layout shift) */}
      <div className="min-h-[620px]">
        {shouldShowEmailSection ? (
          <div className="space-y-3 rounded-lg border border-stroke p-4 dark:border-dark-3">
            <h4 className="text-body-sm font-semibold text-dark dark:text-white">Email Section</h4>
            <div className="flex flex-wrap items-center gap-4">
              {canUseSosTemplate ? (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-dark dark:text-white">
                  <input
                    type="radio"
                    name="emailTemplate"
                    value="sos_check_in"
                    checked={emailTemplateKey === "sos_check_in"}
                    onChange={() => handleSelectTemplate("sos_check_in")}
                    className="h-4 w-4 accent-primary"
                  />
                  SOS Check-In Template
                </label>
              ) : null}
              {canUseReferralTemplate ? (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-dark dark:text-white">
                  <input
                    type="radio"
                    name="emailTemplate"
                    value="student_referral"
                    checked={emailTemplateKey === "student_referral"}
                    onChange={() => handleSelectTemplate("student_referral")}
                    className="h-4 w-4 accent-primary"
                  />
                  Student Referral Template
                </label>
              ) : null}
            </div>

            {emailTemplateKey ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    Recipient Email
                  </label>
                  {showReferralRecipientDropdown ? (
                    <select
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    >
                      <option value="">Select wellbeing counsellor email</option>
                      {wellbeingCounsellorEmailOptions.map((option) => (
                        <option key={option.id} value={option.email}>
                          {option.name} ({option.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={replyToEmail}
                    onChange={(e) => setReplyToEmail(e.target.value)}
                    placeholder="reply-to@example.com"
                    className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    Subject
                  </label>
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark dark:text-white">
                    HTML View (Editable)
                  </label>
                  <div className=" dark:border-dark-3 dark:bg-dark-2">
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) =>
                        setEmailBodyHtml((e.currentTarget as HTMLDivElement).innerHTML)
                      }
                      className="h-[420px] w-full overflow-auto  bg-white text-sm text-dark outline-none focus:ring-1 focus:ring-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                      dangerouslySetInnerHTML={{ __html: emailBodyHtml }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-stroke p-4 text-sm text-dark-6 dark:border-dark-3 dark:text-white">
            Email section appears only when status is <span className="font-semibold">Initiated</span> and mode is <span className="font-semibold">Email</span>.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isAdding}
          className="inline-flex items-center justify-center gap-2.5 rounded-[5px] bg-primary py-3.5 px-10 text-center font-medium text-white transition hover:bg-opacity-90 focus:outline-none lg:px-8 xl:px-10"
        >
          {isAdding ? (isSendingEmail ? "Adding + Sending..." : "Adding...") : "Add Intervention"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              onCancel();
            }}
            className="inline-flex items-center justify-center gap-2.5 rounded-[5px] border border-dark py-3.5 px-10 text-center font-medium text-dark transition hover:bg-dark/10 focus:outline-none dark:border-white/25 dark:text-white dark:hover:bg-white/10 lg:px-8 xl:px-10"
          >
            Cancel
          </button>
        )}
      </div>
      {submitMessage && (
        <p
          className={cn(
            "text-sm font-medium",
            submitMessage.type === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {submitMessage.text}
        </p>
      )}
    </form>
  );
};

export default InterventionForm;
