"use server";

import {
  recordStudentAction as saveStudentAction,
} from "@/data/student-actions-store";
import { recordIntervention as saveIntervention } from "@/data/intervention-store";
import type { StudentActionType } from "@/data/student-actions";

const ACTION_TO_OUTREACH: Record<StudentActionType, string> = {
  sent_email: "email",
  made_call: "phone-call",
  inperson_meeting: "meeting",
  referred_to_wellbeing: "meeting",
};

export async function recordStudentAction(
  studentSapId: string,
  actionType: StudentActionType
): Promise<void> {
  saveStudentAction(studentSapId, actionType, "improved");
  // Set intervention status to Initiated so the badge shows Initiated (not Improved) in the table
  saveIntervention(studentSapId, {
    date: new Date().toISOString().slice(0, 10),
    outreach_mode: ACTION_TO_OUTREACH[actionType],
    remarks: "",
    status: "initiated",
  });
}
