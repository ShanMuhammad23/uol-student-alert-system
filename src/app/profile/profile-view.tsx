"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  type Variants,
} from "framer-motion";
import { 
  Camera, 
  Upload, 
  Mail, 
  Shield, 
  Building2, 
  GraduationCap, 
  BookOpen, 
  Award, 
  MapPin, 
  Phone, 
  Calendar, 
  Lock, 
  Eye, 
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Save,
  X,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Types ─────────────────────────────────────────────────────────
type StaffProfileView = {
  name: string | null;
  email: string | null;
  pernr: string | null;
  role: string;
  img: string | null;
  faculty_id: string | null;
  faculty_name: string | null;
  department_names: string[] | null;
  has_password: boolean;
};

type Props = {
  initialProfile: StaffProfileView | null;
};

// ─── Animation Variants ────────────────────────────────────────────
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  })
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
  }
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// ─── Components ────────────────────────────────────────────────────

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  delay 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  color: string; 
  delay: number 
}) {
  return (
    <motion.div
      custom={delay}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900/50 dark:border-slate-700/50",
        "group"
      )}
    >
      <div className={cn("absolute -right-4 -top-4 size-24 rounded-full opacity-10 transition-transform group-hover:scale-110", color)} />
      <div className="relative flex items-start gap-4">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", color, "text-white shadow-lg")}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white truncate">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function SectionCard({ 
  title, 
  icon: Icon, 
  children, 
  delay = 0,
  className 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      custom={delay}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:bg-slate-900/50 dark:border-slate-700/50",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
        <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <Icon className="size-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
}

function AnimatedCounter({ value }: { value: string }) {
  const [display, setDisplay] = useState("");
  
  useEffect(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        value
          .split("")
          .map((char, idx) => {
            if (idx < iteration) return value[idx];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );
      if (iteration >= value.length) clearInterval(interval);
      iteration += 1 / 3;
    }, 30);
    return () => clearInterval(interval);
  }, [value]);
  
  return <span>{display || value}</span>;
}

// ─── Main Component ────────────────────────────────────────────────

export function ProfileView({ initialProfile }: Props) {
  const router = useRouter();
  const { data: session, update } = useSession();
  
  // State
  const [profile, setProfile] = useState<StaffProfileView | null>(initialProfile);
  const [profileReady, setProfileReady] = useState(!!initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  
  // Avatar state
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: "ok" | "err" | "loading"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Password state
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  
  // Scroll animations
  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0.95]);
  const headerScale = useTransform(scrollYProgress, [0, 0.1], [1, 0.98]);
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const scaleX = useSpring(scrollYProgress, springConfig);

  const refreshProfile = useCallback(async () => {
    try {
      const r = await fetch("/api/profile");
      if (!r.ok) { setProfileReady(true); return; }
      const data = await r.json() as StaffProfileView;
      setProfile(data);
      setProfileReady(true);
    } catch {
      setProfileReady(true);
    }
  }, []);

  useEffect(() => { void refreshProfile(); }, [refreshProfile]);

  // Derived values
  const displayImg = !profile?.img && !session?.user?.img 
    ? "/images/user/user-placeholder.jpg"
    : (profile?.img?.startsWith("http") ? profile.img : `/images/${profile?.img}`) 
    || (session?.user?.img?.startsWith("http") ? session.user.img : `/images/${session?.user?.img}`)
    || "/images/user/user-placeholder.jpg";

  const name = profile?.name ?? session?.user?.name ?? "University Staff";
  const email = profile?.email ?? session?.user?.email ?? "—";
  const pernr = profile?.pernr ?? session?.user?.pernr ?? "—";
  const roleLabel = profile?.role ? profile.role.replace(/_/g, " ").toUpperCase() : "STAFF";
  const facultyName = profile?.faculty_name || "—";
  const departments = profile?.department_names?.filter(Boolean) || [];

  // Handlers
  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarMessage({ type: "loading", text: "Uploading your photo..." });
    setAvatarBusy(true);
    
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await r.json() as { ok?: boolean; img?: string; error?: string };
      
      if (!r.ok) {
        setAvatarMessage({ type: "err", text: data.error ?? "Upload failed." });
        return;
      }
      if (data.img) {
        await update({ img: data.img });
        router.refresh();
        await refreshProfile();
        setAvatarMessage({ type: "ok", text: "Profile photo updated!" });
      }
    } catch {
      setAvatarMessage({ type: "err", text: "Upload failed. Please retry." });
    } finally {
      setAvatarBusy(false);
      setTimeout(() => setAvatarMessage(null), 4000);
    }
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (pwNew !== pwConfirm) {
      setPwMessage({ type: "err", text: "Passwords do not match." });
      return;
    }
    setPwBusy(true);
    try {
      const r = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok) {
        setPwMessage({ type: "err", text: data.error ?? "Update failed." });
        return;
      }
      setPwMessage({ type: "ok", text: "Password updated successfully!" });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } finally {
      setPwBusy(false);
    }
  }

  if (!profileReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="size-8 rounded-full border-2 border-emerald-500 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Progress bar */}
      <motion.div 
        className="fixed left-0 right-0 top-0 z-50 h-1 bg-emerald-500 origin-left"
        style={{ scaleX }}
      />

      {/* Hero Section */}
      <motion.div 
        style={{ opacity: headerOpacity, scale: headerScale }}
        className="relative overflow-hidden bg-slate-900 text-white"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 -top-20 size-96 rounded-full bg-emerald-500 blur-3xl" />
          <div className="absolute -right-20 bottom-0 size-80 rounded-full bg-teal-600 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500 blur-3xl" />
        </div>
        
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-12"
          >
            {/* Avatar */}
            <motion.div variants={scaleIn} className="relative shrink-0">
              <div className="relative">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="size-36 overflow-hidden rounded-3xl border-4 border-white/20 shadow-2xl sm:size-44"
                >
                  <Image
                    src={displayImg}
                    width={176}
                    height={176}
                    className="size-full object-cover object-top"
                    alt={name}
                    unoptimized={displayImg.startsWith("http")}
                  />
                </motion.div>
                
                {/* Status indicator */}
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="absolute -bottom-2 -right-2 flex size-10 items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-4 ring-slate-900"
                >
                  <CheckCircle2 className="size-5 text-white" />
                </motion.div>

                {/* Camera button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarBusy}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-lg hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  {avatarBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  {avatarBusy ? "Uploading..." : "Change Photo"}
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={avatarBusy}
                  onChange={onAvatarChange}
                />
              </div>
            </motion.div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <motion.div variants={fadeInUp} custom={0}>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-300 backdrop-blur-sm">
                  <Sparkles className="size-4" />
                  Active Staff Member
                </div>
              </motion.div>

              <motion.h1 
                variants={fadeInUp} 
                custom={1}
                className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              >
                {name}
              </motion.h1>

              <motion.p 
                variants={fadeInUp} 
                custom={2}
                className="mt-2 text-lg text-slate-300"
              >
                {email}
              </motion.p>

              <motion.div 
                variants={fadeInUp} 
                custom={3}
                className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                  <Shield className="size-4 text-emerald-400" />
                  {roleLabel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                  <GraduationCap className="size-4 text-cyan-400" />
                  {resolveFacultyNameFromIdOrName(facultyName)}
                </span>
              </motion.div>

              {/* Avatar message */}
              <AnimatePresence>
                {avatarMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                      avatarMessage.type === "ok" && "bg-emerald-500/20 text-emerald-300",
                      avatarMessage.type === "err" && "bg-red-500/20 text-red-300",
                      avatarMessage.type === "loading" && "bg-amber-500/20 text-amber-300"
                    )}
                  >
                    {avatarMessage.type === "ok" && <CheckCircle2 className="size-4" />}
                    {avatarMessage.type === "err" && <AlertCircle className="size-4" />}
                    {avatarMessage.type === "loading" && <Loader2 className="size-4 animate-spin" />}
                    {avatarMessage.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

     
      </motion.div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 pb-20 -mt-8 relative z-10">
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-6 lg:grid-cols-3"
        >
          {/* Stats Cards */}
          <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              icon={Building2} 
              label="Pernr" 
              value={pernr} 
              color="bg-emerald-500" 
              delay={0} 
            />
            <StatCard 
              icon={GraduationCap} 
              label="Faculty" 
              value={resolveFacultyNameFromIdOrName(facultyName) ?? "—"}
              color="bg-cyan-500" 
              delay={1} 
            />
            <StatCard 
              icon={BookOpen} 
              label="Departments" 
              value={departments.length.toString()} 
              color="bg-violet-500" 
              delay={2} 
            />
            <StatCard 
              icon={Award} 
              label="Role" 
              value={roleLabel} 
              color="bg-amber-500" 
              delay={3} 
            />
          </div>

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
     

            {/* Departments */}
            <SectionCard title="Departments" icon={BookOpen} delay={5}>
              {departments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept, i) => (
                    <motion.span
                      key={dept}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800"
                    >
                      <Building2 className="size-3.5" />
                      {dept}
                    </motion.span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No departments assigned.</p>
              )}
            </SectionCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Security */}
            <SectionCard title="Security" icon={Lock} delay={6}>
              {!profile?.has_password ? (
                <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">External Authentication</p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        You use external login (Google/LDAP). Password change is not available.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={onPasswordSubmit} className="space-y-4">
                  <AnimatePresence>
                    {pwMessage && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium",
                          pwMessage.type === "ok" 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" 
                            : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                        )}
                      >
                        {pwMessage.type === "ok" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                        {pwMessage.text}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {[
                    { label: "Current Password", value: pwCurrent, setter: setPwCurrent, key: "current", autoComplete: "current-password" },
                    { label: "New Password", value: pwNew, setter: setPwNew, key: "new", autoComplete: "new-password" },
                    { label: "Confirm Password", value: pwConfirm, setter: setPwConfirm, key: "confirm", autoComplete: "new-password" },
                  ].map((field) => (
                    <div key={field.key} className="relative">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {field.label}
                      </label>
                      <div className="relative">
                        <input
                          type={showPw[field.key as keyof typeof showPw] ? "text" : "password"}
                          autoComplete={field.autoComplete}
                          value={field.value}
                          onChange={(e) => field.setter(e.target.value)}
                          required
                          minLength={8}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(prev => ({ ...prev, [field.key]: !prev[field.key as keyof typeof prev] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          {showPw[field.key as keyof typeof showPw] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={pwBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                    {pwBusy ? "Updating..." : "Update Password"}
                  </motion.button>
                </form>
              )}
            </SectionCard>

          
          </div>
        </motion.div>
      </div>
    </div>
  );
}