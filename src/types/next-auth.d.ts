import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    pernr: string;
    name: string;
    email: string;
    role:
      | "superadmin"
      | "dean"
      | "hod"
      | "instructor"
      | "wellbeing"
      | "wellbeing-head"
      | "wellbeing-counseller";
    actual_role: "coordinator" | "admin" | null;
    pseudo_role:
      | "superadmin"
      | "dean"
      | "hod"
      | "instructor"
      | "wellbeing"
      | "wellbeing-head"
      | "wellbeing-counseller"
      | null;
    img: string | null;
    faculty_id: string | null;
    department_ids: string[];
  }

  interface Session {
    user: User & DefaultSession["user"];
    expires: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    pernr?: string;
    name?: string;
    email?: string;
    role?:
      | "superadmin"
      | "dean"
      | "hod"
      | "instructor"
      | "wellbeing"
      | "wellbeing-head"
      | "wellbeing-counseller";
    actual_role?: "coordinator" | "admin" | null;
    pseudo_role?:
      | "superadmin"
      | "dean"
      | "hod"
      | "instructor"
      | "wellbeing"
      | "wellbeing-head"
      | "wellbeing-counseller"
      | null;
    img?: string | null;
    faculty_id?: string | null;
    department_ids?: string[];
    login_at?: number;
    exp?: number;
  }
}
