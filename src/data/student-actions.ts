

export type StudentActionType =
  | "sent_email"
  | "made_call"
  | "referred_to_wellbeing"
  | "inperson_meeting";

export type StudentActionResult = "escalated" | "improved";

export type StudentAction = {
  id: string;
  student_sap_id: string;
  action_type: StudentActionType;
  result: StudentActionResult;
  performed_at: string; // ISO date
  note?: string;
};

const ACTION_LABELS: Record<StudentActionType, string> = {
  sent_email: "Email",
  made_call: "Phone Call",
  inperson_meeting: "Meeting",
  referred_to_wellbeing: "Referred - WC",
};

const RESULT_LABELS: Record<StudentActionResult, string> = {
  escalated: "Escalated",
  improved: "Improved",
};

export function getActionTypeLabel(type: StudentActionType): string {
  return ACTION_LABELS[type];
}

export function getActionResultLabel(result: StudentActionResult): string {
  return RESULT_LABELS[result];
}

/** Dummy actions for a few students so list and detail pages show results (escalated/improved). */
export const DUMMY_ACTIONS: StudentAction[] = [
  {
    id: "act-1",
    student_sap_id: "900001",
    action_type: "sent_email",
    result: "improved",
    performed_at: "2025-02-20T10:00:00Z",
    note: "Follow-up on low attendance.",
  },
  {
    id: "act-2",
    student_sap_id: "900001",
    action_type: "made_call",
    result: "improved",
    performed_at: "2025-02-18T14:30:00Z",
  },
  {
    id: "act-3",
    student_sap_id: "900002",
    action_type: "referred_to_wellbeing",
    result: "escalated",
    performed_at: "2025-02-19T09:15:00Z",
    note: "Referred for academic stress.",
  },
  {
    id: "act-4",
    student_sap_id: "900002",
    action_type: "made_call",
    result: "improved",
    performed_at: "2025-02-15T11:00:00Z",
  },
  {
    id: "act-5",
    student_sap_id: "800001",
    action_type: "sent_email",
    result: "escalated",
    performed_at: "2025-02-21T08:00:00Z",
  },
  {
    id: "act-6",
    student_sap_id: "800003",
    action_type: "referred_to_wellbeing",
    result: "improved",
    performed_at: "2025-02-17T16:00:00Z",
  },
];

export function getActionsByStudentSapId(sapId: string): StudentAction[] {
  return DUMMY_ACTIONS.filter((a) => a.student_sap_id === sapId).sort(
    (a, b) =>
      new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
  );
}

/** Latest result for this student (for showing "Improved" / "Escalated" in the list). */
export function getLatestResultForStudent(
  sapId: string
): StudentActionResult | null {
  const actions = getActionsByStudentSapId(sapId);
  return actions.length > 0 ? actions[0].result : null;
}
