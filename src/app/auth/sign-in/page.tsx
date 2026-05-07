import Signin from "@/components/Auth/Signin";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
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
    <>
      <Breadcrumb pageName="Sign In" />

      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-center justify-center">
          <div className="w-full border xl:w-1/2 mx-auto">
            <div className="w-full p-4 sm:p-12.5 xl:p-15">
              <Signin />
            </div>
          </div>

          
        </div>
      </div>
    </>
  );
}
