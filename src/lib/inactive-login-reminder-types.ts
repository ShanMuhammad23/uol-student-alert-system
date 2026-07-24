export type InactiveLoginReminderRow = {
  staffId: string;
  staffPernr: string;
  staffName: string;
  staffEmail: string;
  facultyId: string | null;
  loginCount: number;
  lastLoginAt: Date | null;
  lastLoginDisplay: string;
  neverLoggedIn: boolean;
};
