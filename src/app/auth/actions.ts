"use server";

import { redirect } from "next/navigation";

/** Redirects to NextAuth signout endpoint so the session is cleared. */
export async function signOut() {
  redirect("/api/auth/signout?callbackUrl=/auth/sign-in");
}
