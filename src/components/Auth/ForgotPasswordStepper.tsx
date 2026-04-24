"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Step = 1 | 2 | 3;

const steps = [
  { id: 1, title: "Send OTP" },
  { id: 2, title: "Verify OTP" },
  { id: 3, title: "Reset Password" },
] as const;

const initialEmail = "";
const initialOtp = "";
const initialPassword = "";
const initialConfirmPassword = "";

export default function ForgotPasswordStepper() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialOtp);
  const [newPassword, setNewPassword] = useState(initialPassword);
  const [confirmPassword, setConfirmPassword] = useState(initialConfirmPassword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const stepContentRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = useMemo(() => {
    if (step === 1) return email.trim().length > 0;
    if (step === 2) return otp.trim().length === 6;
    return newPassword.length >= 8 && confirmPassword.length >= 8;
  }, [step, email, otp, newPassword, confirmPassword]);

  useEffect(() => {
    const node = stepContentRef.current;
    if (!node) return;
    node.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "ease-out" }
    );
  }, [step]);

  useEffect(() => {
    const node = messageRef.current;
    if (!node || (!error && !success)) return;
    node.animate(
      [
        { opacity: 0, transform: "translateY(-4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "ease-out" }
    );
  }, [error, success]);

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong while sending OTP.");
        return;
      }
      setSuccess(data.message ?? "OTP has been sent. Please check your email.");
      setStep(2);
    } catch {
      setError("Unable to connect right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "OTP verification failed. Please try again.");
        return;
      }
      setSuccess(data.message ?? "OTP verified successfully.");
      setStep(3);
    } catch {
      setError("Unable to verify OTP right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitStep3(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match. Please re-enter both fields.");
        return;
      }

      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password. Please try again.");
        return;
      }
      setSuccess(data.message ?? "Password reset successful. Please sign in.");
      setStep(1);
      setEmail(initialEmail);
      setOtp(initialOtp);
      setNewPassword(initialPassword);
      setConfirmPassword(initialConfirmPassword);
    } catch {
      setError("Something went wrong while resetting password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-2 rounded-2xl border border-stroke/60 bg-white/80 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 dark:border-dark-3 dark:bg-dark-2/80 sm:p-6">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Complete all steps to secure your account.
        </p>
      </div>

      <div className="mb-8 mt-5 flex items-center justify-between gap-2">
        {steps.map((item) => {
          const active = step === item.id;
          const completed = step > item.id;
          return (
            <div key={item.id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  completed
                    ? "bg-green-600 text-white shadow-md shadow-green-600/30"
                    : active
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "bg-gray-200 text-gray-600 dark:bg-dark-3 dark:text-gray-300"
                }`}
              >
                {item.id}
              </div>
              <p
                className={`text-xs font-medium transition-colors duration-300 sm:text-sm ${
                  active
                    ? "text-primary"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {item.title}
              </p>
            </div>
          );
        })}
      </div>

      <div ref={messageRef} className="mb-4 min-h-14 transition-all duration-300">
        {error ? (
          <p className="rounded-lg border border-red/20 bg-red/10 px-3 py-2 text-sm text-red transition-all duration-300">
            {error}
          </p>
        ) : success ? (
          <p className="rounded-lg border border-green-200 bg-green-100 px-3 py-2 text-sm text-green-700 transition-all duration-300 dark:border-green-500/30 dark:bg-green-900/30 dark:text-green-300">
            {success}
          </p>
        ) : (
          <div className="h-10" />
        )}
      </div>

      <div ref={stepContentRef} className="min-h-[290px]">
        {step === 1 && (
        <form onSubmit={submitStep1} className="transition-all duration-300">
          <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your account email"
            className="mb-4 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            required
          />
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="flex w-full items-center justify-center rounded-xl bg-primary p-4 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitStep2} className="transition-all duration-300">
          <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
            6-digit OTP
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter OTP from your email"
            className="mb-4 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            required
          />
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            Didn&apos;t receive it? Go back and request a new OTP.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-1/3 rounded-xl border border-stroke p-4 font-medium text-dark transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-2/3 rounded-xl bg-primary p-4 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={submitStep3} className="transition-all duration-300">
          <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mb-4 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            required
          />
          <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="mb-4 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            required
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-1/3 rounded-xl border border-stroke p-4 font-medium text-dark transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-2/3 rounded-xl bg-primary p-4 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      )}
      </div>

      <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
        Remember your password?{" "}
        <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </section>
  );
}
