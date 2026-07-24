export type EtlRunRow = {
  id: number;
  pipelineName: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "success" | "failed" | "partial";
  sourceRowsEnrollment: number;
  sourceRowsAttendance: number;
  sourceRowsMonitoring: number;
  producedRowsCurrent: number;
  producedRowsDaily: number;
  errorMessage: string | null;
};
