import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { getStaffByEmailWithDepartments } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    Credentials({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim();
        const password = String(credentials.password);

        const result = await getStaffByEmailWithDepartments(email);
        if (!result) return null;

        const { staff, departmentIds } = result;
        const hash = staff.password_hash;
        if (!hash) return null;

        const valid = await compare(password, hash);
        if (!valid) return null;

        return {
          id: staff.id,
          pernr: staff.pernr,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          img: staff.img,
          faculty_id: staff.faculty_id,
          department_ids: departmentIds,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = String(user.email ?? "").trim();
      if (!email) return "/auth/sign-in?error=NotAuthorized";

      const result = await getStaffByEmailWithDepartments(email);
      if (!result) return "/auth/sign-in?error=NotAuthorized";

      const { staff, departmentIds } = result;
      const mutableUser = user as typeof user & {
        id: string;
        pernr: string;
        role: "superadmin" | "dean" | "hod" | "instructor" | "wellbeing";
        img: string | null;
        faculty_id: string | null;
        department_ids: string[];
      };
      mutableUser.id = staff.id;
      mutableUser.pernr = staff.pernr;
      mutableUser.name = staff.name;
      mutableUser.email = staff.email;
      mutableUser.role = staff.role;
      mutableUser.img = staff.img;
      mutableUser.faculty_id = staff.faculty_id;
      mutableUser.department_ids = departmentIds;
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.pernr = user.pernr;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.img = user.img;
        token.faculty_id = user.faculty_id;
        token.department_ids = user.department_ids ?? [];
      }
      if (trigger === "update" && session) {
        const s = session as { img?: string | null; name?: string | null };
        if (s.img !== undefined) token.img = s.img;
        if (s.name !== undefined) token.name = s.name ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.pernr = token.pernr;
        session.user.name = token.name ?? "";
        session.user.email = token.email ?? "";
        session.user.role = token.role;
        session.user.img = token.img;
        session.user.faculty_id = token.faculty_id ?? null;
        session.user.department_ids = token.department_ids ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/sign-in",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
