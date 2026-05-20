"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import {
  X,
  Mail,
  MessageCircle,
  ShieldAlert,
  GraduationCap,
  Building2,
  User,
  Hash,
  Award,
  ClipboardList,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UnregisteredEmailModalProps = {
  email: string;
  open: boolean;
  onClose: () => void;
};

/* ── Magnetic Button ── */
function ModalButton({
  onClick,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg px-6 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200",
        variant === "primary"
          ? "bg-slate-800 text-white shadow-lg shadow-slate-800/20 hover:bg-slate-700 hover:shadow-slate-800/30"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
      )}
    >
      {children}
    </motion.button>
  );
}

/* ── Requirement Item ── */
function RequirementItem({
  icon: Icon,
  label,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100">
        <Icon className="h-3.5 w-3.5 text-amber-700" />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </motion.div>
  );
}

/* ── Contact Channel ── */
function ContactChannel({
  icon: Icon,
  label,
  value,
  href,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href: string;
  delay: number;
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4",
        "transition-all duration-200 hover:border-amber-300 hover:shadow-md hover:shadow-amber-500/5"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover:bg-amber-50">
        <Icon className="h-5 w-5 text-slate-600 transition-colors group-hover:text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800 group-hover:text-amber-700">
          {value}
        </p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-all group-hover:opacity-100 group-hover:text-amber-500" />
    </motion.a>
  );
}

export function UnregisteredEmailModal({
  email,
  open,
  onClose,
}: UnregisteredEmailModalProps) {
  const displayEmail = email.trim() || "your email";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unregistered-email-title"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]",
              "dark:border-slate-700 dark:bg-slate-900"
            )}
          >
            {/* Top accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />

            {/* Close button */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="absolute right-4 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </motion.button>

            <div className="p-6 sm:p-8">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-6 flex items-start gap-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="space-y-1">
                  <h2
                    id="unregistered-email-title"
                    className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
                  >
                    Account Not Found
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    The email address below is not registered in the Student Early Alert System.
                  </p>
                </div>
              </motion.div>

              {/* Email Display */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20"
              >
                <Mail className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  {displayEmail}
                </span>
              </motion.div>

              {/* Contact Section */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-6 space-y-3"
              >
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Contact for Access
                </h3>
                <div className="grid gap-3">
                  <ContactChannel
                    icon={Mail}
                    label="Email"
                    value="shan.muhammad@spmo.uol.edu.pk"
                    href="mailto:shan.muhammad@spmo.uol.edu.pk"
                    delay={0.35}
                  />
                  <ContactChannel
                    icon={MessageCircle}
                    label="WhatsApp"
                    value="0321 9720819"
                    href="https://wa.me/923219720819"
                    delay={0.4}
                  />
                </div>
              </motion.div>

              {/* Requirements Section */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mb-8 space-y-3"
              >
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Please Include the Following
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <RequirementItem
                    icon={User}
                    label="Full Name"
                    delay={0.5}
                  />
                  <RequirementItem
                    icon={Mail}
                    label="Official Email"
                    delay={0.55}
                  />
                  <RequirementItem
                    icon={Hash}
                    label="SAP ID"
                    delay={0.6}
                  />
                  <RequirementItem
                    icon={Award}
                    label="Role (Dean, HoD, etc.)"
                    delay={0.65}
                  />
                  <RequirementItem
                    icon={Building2}
                    label="Faculty"
                    delay={0.7}
                  />
                  <RequirementItem
                    icon={GraduationCap}
                    label="Department"
                    delay={0.75}
                  />
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center justify-end gap-3"
              >
                <ModalButton onClick={onClose} variant="ghost">
                  Close
                </ModalButton>
                <ModalButton onClick={onClose} variant="primary">
                  <span className="flex items-center gap-2">
                    Understood
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </ModalButton>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}