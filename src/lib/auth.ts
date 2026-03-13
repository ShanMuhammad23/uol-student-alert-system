import { cookies } from "next/headers";

const DEMO_USER_EMAIL_COOKIE = "demo_user_email";

export async function getDemoUserEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_USER_EMAIL_COOKIE)?.value ?? null;
}

export function getDemoUserEmailCookieName(): string {
  return DEMO_USER_EMAIL_COOKIE;
}
