"use client";

import { GoogleIcon } from "@/assets/icons";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function GoogleSigninButton({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);

  const onGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <button
      type="button"
      onClick={onGoogleSignIn}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3.5 rounded-lg border border-stroke bg-gray-2 p-[15px] font-medium hover:bg-opacity-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-dark-3 dark:bg-dark-2 dark:hover:bg-opacity-50"
    >
      <GoogleIcon />
      {loading ? "Redirecting..." : `${text} with Google`}
    </button>
  );
}
