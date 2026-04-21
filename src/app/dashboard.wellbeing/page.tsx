import { redirect } from "next/navigation";

export default async function LegacyWellbeingDashboardPage() {
  redirect("/dashboard/wellbeing");
}
