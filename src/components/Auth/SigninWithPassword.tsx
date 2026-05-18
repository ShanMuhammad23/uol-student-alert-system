"use client";

import { EmailIcon, PasswordIcon, EyeOpenIcon, EyeClosedIcon } from "@/assets/icons";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { AUTH_ERROR_EMAIL_NOT_REGISTERED } from "@/lib/auth-errors";
import { UnregisteredEmailModal } from "./UnregisteredEmailModal";
import InputGroup from "../FormElements/InputGroup";

export default function SigninWithPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState({
    email: "",
    password:"",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unregisteredEmail, setUnregisteredEmail] = useState<string | null>(
    null
  );

  useEffect(() => {
    const queryError = searchParams.get("error");
    const queryEmail = searchParams.get("email")?.trim() ?? "";
    if (queryError === AUTH_ERROR_EMAIL_NOT_REGISTERED) {
      setUnregisteredEmail(queryEmail || data.email.trim() || "");
    }
  }, [searchParams, data.email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email: data.email.trim(),
      password: data.password,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    if (result?.error) {
      setLoading(false);
      const emailAttempted = data.email.trim();
      if (result.error === AUTH_ERROR_EMAIL_NOT_REGISTERED) {
        setUnregisteredEmail(emailAttempted);
        setError(null);
        return;
      }
      setError("Invalid email or password");
      return;
    }
    if (result?.ok) {
      // Force full document navigation so root server layout/session-dependent
      // header data refreshes immediately after login.
      const session = await getSession();
      const destination =
        session?.user?.role === "superadmin"
          ? "/dashboard/superadmin"
          : "/dashboard";
      window.location.assign(destination);
      return;
    }
    setLoading(false);
    setError("Sign in failed");
  };

  return (
    <>
      <UnregisteredEmailModal
        email={unregisteredEmail ?? ""}
        open={unregisteredEmail != null}
        onClose={() => setUnregisteredEmail(null)}
      />
    <form onSubmit={handleSubmit}>
      {searchParams.get("error") === "NotAuthorized" && (
        <p className="mb-4 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
          Not authorized. Your Google account is not allowed for this system.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your email"
        name="email"
        handleChange={handleChange}
        value={data.email}
        icon={<EmailIcon />}
      />

      <InputGroup
        type={showPassword ? "text" : "password"}
        label="Password"
        className="mb-5 [&_input]:py-[15px]"
        placeholder="Enter your password"
        name="password"
        handleChange={handleChange}
        value={data.password}
        icon={showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
        showPassword={showPassword}
        togglePasswordVisibility={togglePasswordVisibility}
      />

      <div className="mb-6 flex items-center justify-between gap-2 py-2 font-medium">
       

        <Link
          href="/auth/forgot-password"
          className="hover:text-primary dark:text-white dark:hover:text-primary"
        >
          Forgot Password?
        </Link>
      </div>

      <div className="mb-4.5">
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90"
        >
          Sign In
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
    </>
  );
}
