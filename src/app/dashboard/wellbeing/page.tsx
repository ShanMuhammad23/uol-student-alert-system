import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";

export default async function WellbeingIndexPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  if (user.role === "wellbeing-head" || user.role === "superadmin") {
    redirect("/dashboard/wellbeing/admin");
  }
  if (user.role === "wellbeing-counseller" || user.role === "wellbeing") {
    redirect("/dashboard/wellbeing/counseller");
  }

  redirect("/dashboard");
}
