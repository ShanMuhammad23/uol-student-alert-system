import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { getWellbeingHeadDashboardData } from "@/lib/db/wellbeing-head-dashboard";
import { WellbeingHeadSection } from "./_components/WellbeingHeadSection";

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

  const dashboardData = await getWellbeingHeadDashboardData();

  return (
    <div className="mt-4 space-y-4">
    

      <WellbeingHeadSection
        title="Total Records"
        metrics={dashboardData.totalRecords}
      />

      <section className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
       
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <WellbeingHeadSection
            title="Referred Cases"
            metrics={dashboardData.referredCases}
            compact
          />
          <WellbeingHeadSection
            title="Direct Cases"
            metrics={dashboardData.directCases}
            compact
          />
        </div>
      </section>
    </div>
  );
}
