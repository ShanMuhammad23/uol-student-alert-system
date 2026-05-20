// Signin/index.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import GoogleSigninButton from "../GoogleSigninButton";
import SigninWithPassword from "../SigninWithPassword";

/* ── Refined Divider ── */
function AcademicDivider() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.9 }}
      className="my-6 flex items-center gap-4"
    >
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Or sign in with email
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </motion.div>
  );
}

/* ── Google Button with Academic Styling ── */
function AcademicGoogleButton({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
    >
      <GoogleSigninButton text={text} />
    </motion.div>
  );
}

export default function Signin() {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <section className="relative">
      {isContactModalOpen ? (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-dark/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-help-title"
          onClick={() => setIsContactModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="contact-help-title"
              className="text-center text-base font-semibold leading-relaxed text-dark dark:text-white"
            >
              How to get access?
            </p>
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              Please send an email to{" "}
              <a
                href="mailto:shan.muhammad@spmo.uol.edu.pk"
                className="text-primary hover:underline"
              >
                shan.muhammad@spmo.uol.edu.pk
              </a>{" "}
              <br /> or WhatsApp on{" "}
              <a
                href="https://wa.me/923219720819"
                className="text-primary hover:underline"
              >
                03219720819
              </a>{" "}
              by attaching the following info:
            </p>
            <ul className="mt-3 list-inside list-disc text-sm text-dark-5 dark:text-dark-6">
              <li>Name</li>
              <li>Official Email Address</li>
              <li>SAPID</li>
              <li>Role: (Dean, HoD, Instructor, Wellbeing, Admin/Coordinator)</li>
              <li>Faculty, Department</li>
            </ul>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-opacity-90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AcademicGoogleButton text="Sign in with Google" />

      <AcademicDivider />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.0, ease: [0.23, 1, 0.32, 1] }}
      >
        <SigninWithPassword />
      </motion.div>

      {/* Help link — academic support context */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mt-6 text-center"
      >
        <button
          type="button"
          onClick={() => setIsContactModalOpen(true)}
          className="text-xs text-slate-400 transition-colors hover:text-slate-600 hover:underline"
        >
          Need help accessing your account? Contact Here
        </button>
      </motion.div>
    </section>
  );
}