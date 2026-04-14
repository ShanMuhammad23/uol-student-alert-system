import { redirect } from "next/navigation";
import { TopChannelsTableClient } from "@/components/Tables/nested-students-table/TopChannelsTableClient";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";

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
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Students whose latest intervention status is referred or resolved, including wellbeing status.
        </p>
      </div>

      <TopChannelsTableClient
        returnToUrl="/dashboard.wellbeing"
        interventionFilters={["referred", "resolved"]}
      />
    </div>
  );
}
