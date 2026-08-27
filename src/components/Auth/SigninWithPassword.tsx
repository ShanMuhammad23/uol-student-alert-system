// SigninWithPassword.tsx — Academic Premium
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSession, signIn } from "next-auth/react";
import { AUTH_ERROR_EMAIL_NOT_REGISTERED } from "@/lib/auth-errors";
import { UnregisteredEmailModal } from "./UnregisteredEmailModal";

export default function SigninWithPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unregisteredEmail, setUnregisteredEmail] = useState<string | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        if (result.error === AUTH_ERROR_EMAIL_NOT_REGISTERED) {
          setUnregisteredEmail(email.trim());
          return;
        }
        setError("Invalid email or password");
        return;
      }

      if (result?.ok) {
        const session = await getSession();
        const destination =
          session?.user?.role === "superadmin"
            ? "/dashboard/superadmin"
            : "/dashboard";
        window.location.assign(destination);
        return;
      }

      setError("Sign in failed");
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <UnregisteredEmailModal
        email={unregisteredEmail ?? ""}
        open={unregisteredEmail != null}
        onClose={() => setUnregisteredEmail(null)}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      ) : null}
      {/* Email Field */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.05 }}
        className="group space-y-1.5"
      >
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-amber-700">
          University Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-amber-600" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 md:text-sm",
              "outline-none transition-all duration-200",
              "focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
              "hover:border-slate-300"
            )}
            placeholder="name@uol.edu.pk"
            required
          />
        </div>
      </motion.div>

      {/* Password Field */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.15 }}
        className="group space-y-1.5"
      >
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-amber-700">
            Password
          </label>
          <a
            href="/auth/forgot-password"
            className="text-xs font-medium text-slate-500 transition-colors hover:text-amber-700"
          >
            Forgot?
          </a>
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-amber-600" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-11 text-base text-slate-900 placeholder:text-slate-400 md:text-sm",
              "outline-none transition-all duration-200",
              "focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
              "hover:border-slate-300"
            )}
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>

      {/* Submit Button — Academic Gold/Navy */}
      <motion.button
        type="submit"
        disabled={isLoading}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.25 }}
        whileHover={{ y: -1, boxShadow: "0 10px 30px -10px rgba(180, 83, 9, 0.3)" }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold tracking-tight text-white",
          "bg-gradient-to-r from-slate-800 to-slate-900 shadow-lg",
          "transition-all duration-300 hover:from-slate-700 hover:to-slate-800",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        <span className="flex items-center gap-2">
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <>
              <GraduationCap className="h-4 w-4" />
              Sign In to Portal
            </>
          )}
        </span>
      </motion.button>
      </form>
    </>
  );
}