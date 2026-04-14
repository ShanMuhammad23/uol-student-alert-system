import { redirect } from "next/navigation";
import { getCurrentUser } from "./(home)/dashboard/fetch";

const HomePage = async () => {
  const user = await getCurrentUser();
  if (user?.role === "superadmin") {
    redirect("/dashboard/superadmin");
  }
  if (user?.role === "wellbeing") {
    redirect("/dashboard.wellbeing");
  }
  redirect("/dashboard");
};

export default HomePage;