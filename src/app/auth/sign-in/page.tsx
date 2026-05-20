import Signin from "@/components/Auth/Signin";
import { SignInLayout } from "@/components/Auth/SignInLayout";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignIn() {
  // Only redirect when a valid authenticated identity is present.
  const session = await getServerSession(authOptions);
  if (session?.user?.id && session.user.role) {
    redirect(
      session.user.role === "superadmin"
        ? "/dashboard/superadmin"
        : "/dashboard"
    );
  }

  return (
    <SignInLayout>
      <Signin />
    </SignInLayout>
  );
}
