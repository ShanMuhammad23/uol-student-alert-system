import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { getStaffProfileById } from "@/lib/db";
import { getInterventionsByStaffIdFromDb } from "@/lib/db/interventions";
import { ProfileView } from "./profile-view";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  const initialProfile = await getStaffProfileById(user.id);
  const initialInterventions = await getInterventionsByStaffIdFromDb(user.id);

  return (
    <ProfileView
      initialProfile={initialProfile}
      initialInterventions={initialInterventions}
    />
  );
}
