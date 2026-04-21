import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getMasterFilterOptions,
  type MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";
import { WellbeingDashboardClient } from "@/app/dashboard.wellbeing/_components/WellbeingDashboardClient";

export default async function WellbeingCounsellerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  if (user.role === "wellbeing-head") {
    redirect("/dashboard/wellbeing/admin");
  }
  if (
    user.role !== "wellbeing-counseller" &&
    user.role !== "wellbeing" &&
    user.role !== "superadmin"
  ) {
    redirect("/dashboard");
  }

  const initialMasterFilter: MasterFilterParams = {};
  const filterOptions = await getMasterFilterOptions(user, initialMasterFilter);

  return (
    <WellbeingDashboardClient
      initialMasterFilter={initialMasterFilter}
      filterOptions={filterOptions}
      asWellbeingScope={user.role === "superadmin"}
    />
  );
}
