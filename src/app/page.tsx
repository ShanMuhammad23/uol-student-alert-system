import { redirect } from "next/navigation";
import { getCurrentUser } from "./(home)/dashboard/fetch";

const HomePage = async () => {
  const user = await getCurrentUser();
  if (user?.role === "superadmin") {
    redirect("/dashboard/superadmin");
  }
  if (user?.role === "wellbeing-head") {
    redirect("/dashboard/wellbeing/admin");
  }
  if (user?.role === "wellbeing-counseller" || user?.role === "wellbeing") {
    redirect("/dashboard/wellbeing/counseller");
  }
  redirect("/dashboard");
};

export default HomePage;