"use client";

import { motion, useInView, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "superadmin"
  | "dean"
  | "hod"
  | "instructor"
  | "wellbeingStaff";

type StatCardProps = {
  label: string;
  value: number;
  tone: Tone;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  delay?: number;
};

type StaffStats = {
  totalStaff: number;
  superadminCount: number;
  deanCount: number;
  hodCount: number;
  pseudoDeanCount: number;
  pseudoHodCount: number;
  instructorCount: number;
  wellbeingStaffCount: number;
};

const TONE_CONFIG: Record<
  Tone,
  {
    light: {
      border: string;
      bg: string;
      text: string;
      muted: string;
      glow: string;
      ring: string;
    };
    dark: {
      border: string;
      bg: string;
      text: string;
      muted: string;
      glow: string;
      ring: string;
    };
  }
> = {
  neutral: {
    light: {
      border: "border-slate-700",
      bg: "bg-slate-800",
      text: "text-slate-50",
      muted: "text-slate-300",
      glow: "shadow-slate-900/40",
      ring: "ring-slate-500/40",
    },
    dark: {
      border: "border-slate-600",
      bg: "bg-slate-900",
      text: "text-slate-50",
      muted: "text-slate-300",
      glow: "shadow-black/50",
      ring: "ring-slate-500/50",
    },
  },
  superadmin: {
    light: {
      border: "border-violet-700",
      bg: "bg-violet-800",
      text: "text-violet-50",
      muted: "text-violet-200",
      glow: "shadow-violet-950/40",
      ring: "ring-violet-500/45",
    },
    dark: {
      border: "border-violet-600",
      bg: "bg-violet-900",
      text: "text-violet-50",
      muted: "text-violet-200",
      glow: "shadow-black/50",
      ring: "ring-violet-500/50",
    },
  },
  dean: {
    light: {
      border: "border-blue-700",
      bg: "bg-blue-800",
      text: "text-blue-50",
      muted: "text-blue-200",
      glow: "shadow-blue-950/40",
      ring: "ring-blue-500/45",
    },
    dark: {
      border: "border-blue-600",
      bg: "bg-blue-900",
      text: "text-blue-50",
      muted: "text-blue-200",
      glow: "shadow-black/50",
      ring: "ring-blue-500/50",
    },
  },
  hod: {
    light: {
      border: "border-emerald-700",
      bg: "bg-emerald-800",
      text: "text-emerald-50",
      muted: "text-emerald-200",
      glow: "shadow-emerald-950/40",
      ring: "ring-emerald-500/45",
    },
    dark: {
      border: "border-emerald-600",
      bg: "bg-emerald-900",
      text: "text-emerald-50",
      muted: "text-emerald-200",
      glow: "shadow-black/50",
      ring: "ring-emerald-500/50",
    },
  },
  instructor: {
    light: {
      border: "border-indigo-700",
      bg: "bg-indigo-800",
      text: "text-indigo-50",
      muted: "text-indigo-200",
      glow: "shadow-indigo-950/40",
      ring: "ring-indigo-500/45",
    },
    dark: {
      border: "border-indigo-600",
      bg: "bg-indigo-900",
      text: "text-indigo-50",
      muted: "text-indigo-200",
      glow: "shadow-black/50",
      ring: "ring-indigo-500/50",
    },
  },
  wellbeingStaff: {
    light: {
      border: "border-rose-700",
      bg: "bg-rose-800",
      text: "text-rose-50",
      muted: "text-rose-200",
      glow: "shadow-rose-950/40",
      ring: "ring-rose-500/45",
    },
    dark: {
      border: "border-rose-600",
      bg: "bg-rose-900",
      text: "text-rose-50",
      muted: "text-rose-200",
      glow: "shadow-black/50",
      ring: "ring-rose-500/50",
    },
  },
};

function AnimatedValue({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const springValue = useSpring(0, { damping: 30, stiffness: 100, duration: 1200 });
  const display = useTransform(springValue, (latest) => Math.floor(latest).toLocaleString());

  useEffect(() => {
    if (isInView) springValue.set(value);
  }, [isInView, value, springValue]);

  return (
    <motion.span ref={ref}>
      <motion.span>{display}</motion.span>
    </motion.span>
  );
}

function StatCard({ label, value, tone, trend, subtitle, delay = 0 }: StatCardProps) {
  const config = TONE_CONFIG[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ease-out hover:shadow-lg dark:backdrop-blur-md flex-1",
        config.light.bg,
        `hover:${config.light.glow}`,
        `hover:ring-1 ${config.light.ring}`,
        `dark:${config.dark.bg}`,
        `dark:hover:${config.dark.glow}`,
        `dark:hover:ring-1 dark:${config.dark.ring}`
      )}
    >
      <div className="relative z-10 flex items-start justify-end">
        {trend ? (
          <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", trend.isPositive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")}>
            <span>{trend.isPositive ? "+" : ""}</span>
            <span>{trend.value}%</span>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-4">
        <p className={cn("text-3xl font-bold tracking-tight tabular-nums", config.light.text, `dark:${config.dark.text}`)}>
          <AnimatedValue value={value} />
        </p>
      </div>
      <div className="relative z-10 mt-1">
        <p className={cn("text-[13px] font-semibold tracking-tight", config.light.text, `dark:${config.dark.text}`)}>{label}</p>
      </div>
      {subtitle && <p className={cn("relative z-10 mt-1 text-xs", config.light.muted, `dark:${config.dark.muted}`)}>{subtitle}</p>}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-500 ease-out group-hover:w-full",
          tone === "neutral" && "bg-slate-400",
          tone === "superadmin" && "bg-violet-500",
          tone === "dean" && "bg-blue-500",
          tone === "hod" && "bg-emerald-500",
          tone === "instructor" && "bg-indigo-500",
          tone === "wellbeingStaff" && "bg-rose-500"
        )}
      />
    </motion.div>
  );
}

export function StaffStatsCards({ stats }: { stats: StaffStats }) {
  return (
    <div className="flex flex-wrap gap-3">
      <StatCard label="Total Staff" value={stats.totalStaff} tone="neutral" />
      <StatCard label="Superadmins" value={stats.superadminCount} tone="superadmin" />
      <StatCard label="Deans" value={stats.deanCount} tone="dean" />
      <StatCard label="Pseudo Deans" value={stats.pseudoDeanCount} tone="dean" />
      <StatCard label="HoDs" value={stats.hodCount} tone="hod" />
      <StatCard label="Pseudo HoDs" value={stats.pseudoHodCount} tone="hod" />
      <StatCard label="Instructors" value={stats.instructorCount} tone="instructor" />
      <StatCard label="Wellbeing Staff" value={stats.wellbeingStaffCount} tone="wellbeingStaff" />
    </div>
  );
}
