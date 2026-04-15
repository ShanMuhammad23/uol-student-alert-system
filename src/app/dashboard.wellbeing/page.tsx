import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getMasterFilterOptions,
  type MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";
import { WellbeingDashboardClient } from "./_components/WellbeingDashboardClient";

export default async function WellbeingDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  if (user.role !== "wellbeing") {
    redirect("/dashboard");
  }

  const initialMasterFilter: MasterFilterParams = {};
  const filterOptions = await getMasterFilterOptions(user, initialMasterFilter);

  return (
    <WellbeingDashboardClient
      initialMasterFilter={initialMasterFilter}
      filterOptions={filterOptions}
    />
  );
}
