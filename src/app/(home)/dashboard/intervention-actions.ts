"use server";

import { recordIntervention as saveIntervention } from "@/data/intervention-store";

/** Form payload from Intervention-Form (date, outreachMode, remarks, status). */
export type RecordInterventionInput = {
  date: string;
  outreachMode: string;
  remarks: string;
  status: string;
};

export async function recordIntervention(
  studentSapId: string,
  data: RecordInterventionInput
): Promise<void> {
  saveIntervention(studentSapId, {
    date: data.date,
    outreach_mode: data.outreachMode,
    remarks: data.remarks,
    status: data.status,
  });
}
