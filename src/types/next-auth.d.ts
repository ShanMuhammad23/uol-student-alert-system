import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    pernr: string;
    name: string;
    email: string;
    role: "dean" | "hod" | "instructor";
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
    id: string;
    pernr: string;
    name?: string;
    email?: string;
    role: "dean" | "hod" | "instructor";
    img: string | null;
    faculty_id: string | null;
    department_ids: string[];
  }
}
