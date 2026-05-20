// SignInLayout.tsx
"use client";

import whiteLogo from "@/assets/logos/logo-white.png";
import Image from "next/image";
import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";

/* ── Academic Background ── */
function AcademicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deep institutional navy base */}
      <div className="absolute inset-0 bg-slate-900" />
      
      {/* Subtle architectural gradient — like a library at dusk */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Warm ambient light — scholarly, not techy */}
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
      
      {/* Fine grain texture for paper-like feel */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

/* ── Stagger Animation Variants ── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
  },
};

export function SignInLayout({ children }: PropsWithChildren) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-12">
      <AcademicBackground />
      
      <div className="relative z-10 flex w-full max-w-6xl items-center gap-16 lg:gap-24">
        {/* Left Side — Institutional Branding */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="hidden flex-1 flex-col items-start text-white lg:flex"
        >
          {/* Logo with scholarly frame */}
          <motion.div 
            variants={itemVariants}
            className="relative mb-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
          >
            <div className="relative h-16 w-48">
              <Image
                src={whiteLogo}
                fill
                className="object-contain"
                alt="University of Lahore logo"
                priority
                quality={100}
              />
            </div>
          </motion.div>
          
          <motion.h1
            variants={itemVariants}
            className="text-5xl font-bold tracking-tight text-white sm:text-[3.5rem] leading-[1.1]"
          >
            Student Early
            <br />
            <span className="text-blue-500">Alert System</span>
          </motion.h1>
          
          <motion.p
            variants={itemVariants}
            className="mt-6 max-w-lg text-base leading-relaxed text-slate-400"
          >
            A comprehensive academic intervention platform designed to identify at-risk students early, 
            coordinate faculty responses, and improve retention outcomes across all departments.
          </motion.p>
          
          {/* Institutional stats — academic credibility */}
          

          {/* Trust indicator */}
         
        </motion.div>

        {/* Right Side — Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full lg:max-w-[440px]"
        >
          {/* Warm ivory card — like premium stationery */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:p-10">
            {/* Subtle top accent — university gold */}
            <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />
            
            {/* Mobile Logo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="relative mb-6 flex justify-center lg:hidden"
            >
              <div className="relative h-10 w-28">
                <Image
                  src={whiteLogo}
                  fill
                  className="object-contain"
                  alt="University of Lahore logo"
                  priority
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mb-8 text-center"
            >
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Sign In
              </h2>
              
            </motion.div>

            <div className="relative">{children}</div>
          </div>
          
          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="mt-6 text-center text-xs text-slate-500"
          >
            © 2026 University of Lahore. All rights reserved.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}