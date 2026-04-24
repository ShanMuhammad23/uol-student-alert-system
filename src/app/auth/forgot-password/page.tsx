import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import ForgotPasswordStepper from "@/components/Auth/ForgotPasswordStepper";
import { authOptions } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default async function ForgotPasswordPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(session.user.role === "superadmin" ? "/dashboard/superadmin" : "/dashboard");
  }

  return (
    <>
      <Breadcrumb pageName="Forgot Password" />

      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-center justify-center">
          <div className="mx-auto w-full border xl:w-1/2">
            <div className="w-full p-4 sm:p-12.5 xl:p-15">
              <ForgotPasswordStepper />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}