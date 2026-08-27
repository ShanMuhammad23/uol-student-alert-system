"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  GraduationCap,
  HeartPulse,
  Shield,
  UserCog,
  Users,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "superadmin"
  | "dean"
  | "hod"
  | "instructor"
  | "wellbeingStaff";

export type RoleFilterValue =
  | "all"
  | "superadmin"
  | "dean"
  | "pseudo-dean"
  | "hod"
  | "pseudo-hod"
  | "instructor"
  | "wellbeing-staff";

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

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const TONE_COLOR: Record<Tone, { fill: string; ring: string }> = {
  neutral: { fill: "bg-slate-500", ring: "ring-slate-400" },
  superadmin: { fill: "bg-violet-500", ring: "ring-violet-400" },
  dean: { fill: "bg-cyan-500", ring: "ring-cyan-400" },
  hod: { fill: "bg-emerald-500", ring: "ring-emerald-400" },
  instructor: { fill: "bg-amber-500", ring: "ring-amber-400" },
  wellbeingStaff: { fill: "bg-rose-500", ring: "ring-rose-400" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  delay,
  active = false,
  roleFilter,
  onClickRole,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: Tone;
  delay: number;
  active?: boolean;
  roleFilter?: RoleFilterValue;
  onClickRole?: (role: RoleFilterValue) => void;
}) {
  const reduceMotion = useReducedMotion();
  const color = TONE_COLOR[tone];
  const filterLabel = roleFilter === "all" ? "all roles" : label;

  return (
    <motion.button
      type="button"
      custom={delay}
      variants={fadeInUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
      aria-pressed={active}
      aria-label={`Filter directory by ${filterLabel}`}
      onClick={() => {
        if (roleFilter && onClickRole) onClickRole(roleFilter);
      }}
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm outline-none transition-shadow hover:shadow-md",
        "dark:border-slate-700/50 dark:bg-slate-900/50",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        active && `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-dark ${color.ring}`
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute -right-4 -top-4 size-24 rounded-full opacity-10 transition-transform group-hover:scale-110",
          color.fill
        )}
      />
      <div className="relative flex items-start gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg",
            color.fill
          )}
        >
          <Icon aria-hidden className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

export function StaffStatsCards({
  stats,
  activeRoleFilter = "all",
  onRoleSelect,
  omitSuperadminCard = false,
}: {
  stats: StaffStats;
  activeRoleFilter?: RoleFilterValue;
  onRoleSelect?: (role: RoleFilterValue) => void;
  /** Faculty staff (dean) view: hide Superadmins tile */
  omitSuperadminCard?: boolean;
}) {
  return (
    <section aria-label="Staff overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Users}
        label="Total Staff"
        value={stats.totalStaff}
        tone="neutral"
        delay={0}
        roleFilter="all"
        active={activeRoleFilter === "all"}
        onClickRole={onRoleSelect}
      />
      {!omitSuperadminCard && (
        <StatCard
          icon={Shield}
          label="Superadmins"
          value={stats.superadminCount}
          tone="superadmin"
          delay={1}
          roleFilter="superadmin"
          active={activeRoleFilter === "superadmin"}
          onClickRole={onRoleSelect}
        />
      )}
      <StatCard
        icon={GraduationCap}
        label="Deans"
        value={stats.deanCount}
        tone="dean"
        delay={2}
        roleFilter="dean"
        active={activeRoleFilter === "dean"}
        onClickRole={onRoleSelect}
      />
      <StatCard
        icon={UserCog}
        label="Pseudo Deans"
        value={stats.pseudoDeanCount}
        tone="dean"
        delay={3}
        roleFilter="pseudo-dean"
        active={activeRoleFilter === "pseudo-dean"}
        onClickRole={onRoleSelect}
      />
      <StatCard
        icon={Building2}
        label="HoDs"
        value={stats.hodCount}
        tone="hod"
        delay={4}
        roleFilter="hod"
        active={activeRoleFilter === "hod"}
        onClickRole={onRoleSelect}
      />
      <StatCard
        icon={Waypoints}
        label="Pseudo HoDs"
        value={stats.pseudoHodCount}
        tone="hod"
        delay={5}
        roleFilter="pseudo-hod"
        active={activeRoleFilter === "pseudo-hod"}
        onClickRole={onRoleSelect}
      />
      <StatCard
        icon={BookOpen}
        label="Instructors"
        value={stats.instructorCount}
        tone="instructor"
        delay={6}
        roleFilter="instructor"
        active={activeRoleFilter === "instructor"}
        onClickRole={onRoleSelect}
      />
      <StatCard
        icon={HeartPulse}
        label="Wellbeing Staff"
        value={stats.wellbeingStaffCount}
        tone="wellbeingStaff"
        delay={7}
        roleFilter="wellbeing-staff"
        active={activeRoleFilter === "wellbeing-staff"}
        onClickRole={onRoleSelect}
      />
    </section>
  );
}
