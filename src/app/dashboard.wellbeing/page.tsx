import { redirect } from "next/navigation";
import { TopChannelsTableClient } from "@/components/Tables/nested-students-table/TopChannelsTableClient";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { WellbeingChartClient } from "@/app/(home)/dashboard/_components/WellbeingChartClient";

export default async function WellbeingDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  if (user.role !== "wellbeing") {
    redirect("/dashboard");
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          Wellbeing Referred & Resolved Cases
        </h1>
       
      </div>

      <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <WellbeingChartClient title="Wellbeing cases by category (open vs closed)" />
      </div>

      <TopChannelsTableClient returnToUrl="/dashboard.wellbeing" uniqueStudents />
    </div>
  );
}
