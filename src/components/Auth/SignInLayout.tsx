// SignInLayout.tsx
"use client";

import whiteLogo from "@/assets/logos/logo-white.png";
import Image from "next/image";
import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BellRing, ClipboardCheck, HeartHandshake, Mail } from "lucide-react";

const FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: BellRing,
    title: "Early risk detection",
    description:
      "Surface at-risk students from attendance and GPA, with warning and critical thresholds.",
  },
  {
    icon: ClipboardCheck,
    title: "Coordinated interventions",
    description:
      "Record outreach, follow-ups, and closures across instructors, HoDs, and Deans.",
  },
  {
    icon: HeartHandshake,
    title: "Wellbeing referrals",
    description:
      "Route students to counselling and track case progress through the wellbeing workflow.",
  },
];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.02Zm-7.01 15.24h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.25-8.24 8.25Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.10-.23-.17-.48-.29Z" />
    </svg>
  );
}

function AcademicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      <motion.div
        className="absolute -right-1/4 top-0 h-[700px] w-[700px] rounded-full bg-amber-900/10 blur-[120px]"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.div
        className="absolute -left-1/4 bottom-0 h-[600px] w-[600px] rounded-full bg-emerald-900/10 blur-[100px]"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export function SignInLayout({ children }: PropsWithChildren) {
  return (
    <div className="relative grid min-h-[100dvh] w-full lg:h-[100dvh] lg:max-h-[100dvh] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:overflow-hidden">
      <section className="relative flex min-h-0 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:h-full lg:overflow-y-auto lg:px-12 lg:py-6 xl:px-16">
        <AcademicBackground />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 mx-auto flex w-full max-w-xl flex-col text-white lg:mx-0 lg:h-full lg:min-h-0"
        >
          <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:justify-center">
            <motion.div
              variants={itemVariants}
              className="relative inline-flex self-start rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
            >
              <div className="relative h-9 w-28 sm:h-10 sm:w-32">
                <Image
                  src={whiteLogo}
                  fill
                  sizes="128px"
                  className="object-contain"
                  alt="University of Lahore logo"
                  priority
                />
              </div>
            </motion.div>

            <div className="">
            
              <motion.h1
                variants={itemVariants}
                className="mt-1.5 text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-[3.15rem] lg:leading-[1.15]"
              >
                Student Early{" "}
                <span className="text-blue-400">Alert System</span>
              </motion.h1>
              <motion.p
                variants={itemVariants}
                className="mt-2 max-w-lg text-sm leading-relaxed text-slate-300"
              >
                Identify at-risk students early, coordinate faculty responses, and
                improve retention outcomes across faculties and departments.
              </motion.p>
            </div>

            <motion.ul
              variants={containerVariants}
              className="grid grid-cols-1 gap-2 s"
            >
              {FEATURES.map((feature) => (
                <motion.li
                  key={feature.title}
                  variants={itemVariants}
                  className="flex flex-row items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                    <feature.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug text-white">
                      {feature.title}
                    </span>
                    <span className="mt-0.5 hidden text-[11px] leading-snug text-slate-400 lg:line-clamp-2">
                      {feature.description}
                    </span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <motion.div variants={itemVariants} className="mt-5 shrink-0 lg:mt-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
              <p className="text-xs leading-relaxed text-slate-400">
                For any Technical Issue please contact
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                Shan Muhammad
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  Web Programmer
                </span>
              </p>
              <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                <a
                  href="mailto:shan.muhammad@spmo.uol.edu.pk"
                  className="inline-flex min-h-11 items-center gap-2 break-all text-sm text-slate-300 transition-colors hover:text-amber-300"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  shan.muhammad@spmo.uol.edu.pk
                </a>
                <a
                  href="https://wa.me/923219720819"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300 transition-colors hover:text-emerald-300"
                >
                  <WhatsAppIcon className="h-4 w-4 shrink-0" />
                  03219720819
                </a>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-white/90">
              Developed by SPMO Team
            </p>
          </motion.div>
        </motion.div>
      </section>

      <section className="relative flex min-h-0 flex-col border-t border-amber-500/40 bg-slate-50 px-4 py-8 sm:px-8 sm:py-10 lg:h-full lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-10 lg:py-6">
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 lg:hidden" />
        <div className="absolute bottom-0 left-0 top-0 hidden w-px bg-gradient-to-b from-amber-600/80 via-amber-400 to-amber-600/80 lg:block" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative mx-auto w-full max-w-[440px] lg:my-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 text-center lg:mb-5"
          >
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign In
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Use your university credentials to continue.
            </p>
          </motion.div>

          <div className="relative">{children}</div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-slate-500"
          >
            © 2026 University of Lahore. All rights reserved.
          </motion.p>
        </motion.div>
      </section>
    </div>
  );
}
