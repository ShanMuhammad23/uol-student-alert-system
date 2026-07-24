export type MissingAttendanceReminderRunLog = {
  id: number;
  facultyId: string;
  snapshotDate: string;
  minMissingEntries: number;
  dryRun: boolean;
  candidatesCount: number;
  sentCount: number;
  skippedNoEmail: number;
  skippedDuplicate: number;
  failedCount: number;
  status: "running" | "success" | "failed";
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type MissingAttendanceReminderEmailLog = {
  id: number;
  runId: number;
  status:
    | "sent"
    | "dry_run"
    | "skipped_no_email"
    | "skipped_duplicate_instructor"
    | "failed";
  instructorPernr: string | null;
  instructorName: string | null;
  recipientEmail: string | null;
  courseCode: string | null;
  courseName: string | null;
  departmentName: string | null;
  missingEntries: number;
  emailSubject: string | null;
  errorMessage: string | null;
  ccRecipients: string | null;
  sentAt: string | null;
  createdAt: string;
};
