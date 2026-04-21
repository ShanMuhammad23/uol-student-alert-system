import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";

export default async function WellbeingAdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  if (user.role !== "wellbeing-head" && user.role !== "superadmin") {
    if (user.role === "wellbeing-counseller" || user.role === "wellbeing") {
      redirect("/dashboard/wellbeing/counseller");
    }
    redirect("/dashboard");
  }

  return (
    <div className="mt-4 rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h1 className="text-2xl font-bold text-dark dark:text-white">
        Wellbeing Admin
      </h1>
      <p className="mt-2 text-sm text-dark-5 dark:text-dark-6">
        Admin screen is ready. Share the requirements and I will implement the full content.
      </p>
    </div>
  );
}
