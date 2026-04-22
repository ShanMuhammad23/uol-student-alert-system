import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { getWellbeingHeadDashboardData } from "@/lib/db/wellbeing-head-dashboard";
import {
  getWellbeingAssignableStaff,
  getWellbeingHeadCaseListings,
} from "@/lib/db/wellbeing-head-cases";
import { WellbeingHeadSection } from "./_components/WellbeingHeadSection";
import { WellbeingCaseTabs } from "./_components/WellbeingCaseTabs";

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
  const [caseListings, assignees] = await Promise.all([
    getWellbeingHeadCaseListings(),
    getWellbeingAssignableStaff(),
  ]);

  return (
    <div className="mt-4 space-y-4">
    

      <WellbeingHeadSection
        title="Overall Status"
        metrics={dashboardData.totalRecords}
        statMode="overall"
      />

      <section className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
       
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <WellbeingHeadSection
            title="Referred Cases"
            metrics={dashboardData.referredCases}
            compact
            statMode="referred"
          />
          <WellbeingHeadSection
            title="Direct Cases"
            metrics={dashboardData.directCases}
            compact
            statMode="direct"
          />
        </div>
      </section>

      <WellbeingCaseTabs
        referredCases={caseListings.referredCases}
        directCases={caseListings.directCases}
        assignees={assignees}
      />
    </div>
  );
}
