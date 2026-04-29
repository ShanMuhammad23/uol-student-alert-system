"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, AlertCircle, GraduationCap, CalendarDays, ChevronDown, Sparkles } from "lucide-react";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */
type Row = {
  courseId: string;
  courseTitle: string | null;
  facultyName: string | null;
  departmentName: string | null;
  degreeTitle: string | null;
  sectionCode: string | null;
  eventPackageId: string | null;
  classType: string;
  latestStatus: string | null;
  latestInterventionAt: string | null;
};

/* ──────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────── */
function humanizeStatus(status: string | null): string {
  if (!status) return "—";
  if (status === "in-progress") return "In-Progress";
  if (status === "no-action-required") return "No Action Required";
  return status
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function getStatusColor(status: string | null): string {
  if (!status) return "text-slate-500 dark:text-slate-400";
  if (status === "in-progress") return "text-amber-700 dark:text-amber-400";
  if (status === "no-action-required") return "text-emerald-700 dark:text-emerald-400";
  if (status === "resolved") return "text-emerald-700 dark:text-emerald-400";
  return "text-slate-700 dark:text-slate-300";
}

function getStatusBg(status: string | null): string {
  if (!status) return "bg-slate-200 dark:bg-slate-500/10";
  if (status === "in-progress") return "bg-amber-100 dark:bg-amber-500/10";
  if (status === "no-action-required") return "bg-emerald-100 dark:bg-emerald-500/10";
  if (status === "resolved") return "bg-emerald-100 dark:bg-emerald-500/10";
  return "bg-slate-200 dark:bg-slate-500/10";
}

/* ──────────────────────────────────────────────
   Magnetic Button Component
   ────────────────────────────────────────────── */
function MagneticButton({
  children,
  onClick,
  disabled,
  className,
  isLoading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  isLoading?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 15, stiffness: 150 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    x.set(distX * 0.15);
    y.set(distY * 0.15);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold tracking-tight",
        "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25",
        "transition-shadow duration-300 hover:shadow-indigo-500/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        className,
      )}
    >
      <span className="relative z-10 flex items-center gap-2">
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>
        ) : (
          <Search className="h-4 w-4" />
        )}
        {children}
      </span>
      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ translateX: ["0%", "200%"] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

/* ──────────────────────────────────────────────
   Mouse Spotlight Effect
   ────────────────────────────────────────────── */
function MouseSpotlight({ children }: { children: React.ReactNode }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMouseMove);
    return () => el.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Radial spotlight following cursor */}
      <div
        className="pointer-events-none absolute -inset-px z-0 opacity-40 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99,102,241,0.15), transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Skeleton Loading
   ────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <TableRow className="border-slate-200/80 dark:border-white/5">
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i} className="py-4">
          <motion.div
            className="h-4 rounded-md bg-slate-200 dark:bg-slate-800/50"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            style={{ width: `${60 + Math.random() * 40}%` }}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

/* ──────────────────────────────────────────────
   Bento Card Component
   ────────────────────────────────────────────── */
function BentoCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.03]",
        "shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_20px_rgba(0,0,0,0.3)]",
        "transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_12px_34px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_30px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Animated Counter
   ────────────────────────────────────────────── */
function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */
export function InterventionStudentSearchTab() {
  const [sapId, setSapId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const runSearch = async () => {
    const trimmed = sapId.trim();
    if (!trimmed) {
      setError("Enter a student number.");
      setRows([]);
      setSearchedFor(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/interventions/student-courses?sapId=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch student interventions");
      }
      const body = (await res.json()) as { rows?: Row[] };
      setRows(Array.isArray(body.rows) ? body.rows : []);
      setSearchedFor(trimmed);
    } catch (e) {
      setRows([]);
      setSearchedFor(trimmed);
      setError(e instanceof Error ? e.message : "Failed to fetch student interventions");
    } finally {
      setIsLoading(false);
    }
  };

  // Stats for bento grid
  const uniqueFaculties = new Set(rows.map((r) => r.facultyName).filter(Boolean)).size;
  const inProgressCount = rows.filter((r) => r.latestStatus === "in-progress").length;
  const latestIntervention = rows
    .filter((r) => r.latestInterventionAt)
    .sort((a, b) => new Date(b.latestInterventionAt!).getTime() - new Date(a.latestInterventionAt!).getTime())[0];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800 antialiased selection:bg-indigo-500/30 dark:bg-slate-950 dark:text-slate-200">
      {/* Background ambient gradients */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[600px] w-[600px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Student Intervention Lookup
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Search and analyze intervention records by student SAP ID
          </p>
        </motion.div>

        {/* ── Search Section ── */}
        <MouseSpotlight>
          <div className="relative rounded-2xl border border-slate-200 bg-white/90 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="w-full md:max-w-md">
                <label
                  htmlFor="intervention-search-sap"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  Student Number
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="intervention-search-sap"
                    type="text"
                    value={sapId}
                    onChange={(e) => setSapId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void runSearch();
                      }
                    }}
                    placeholder="Enter SAP ID (e.g., 2024001)"
                    className={cn(
                      "w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-500",
                      "outline-none transition-all duration-200",
                      "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
                      "backdrop-blur-sm",
                    )}
                  />
                </div>
              </div>
              <MagneticButton
                onClick={runSearch}
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? "Searching..." : "Search Interventions"}
              </MagneticButton>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </MouseSpotlight>

        {/* ── Results ── */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Skeleton bento stats */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <BentoCard key={i} delay={i * 0.1} className="p-6">
                    <div className="space-y-3">
                      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800/50" />
                      <div className="h-8 w-16 rounded bg-slate-200 dark:bg-slate-800/50" />
                    </div>
                  </BentoCard>
                ))}
              </div>
              {/* Skeleton table */}
              <BentoCard className="p-0">
                <Table>
                  <TableHeader className="border-b border-slate-200/80 bg-slate-50/90 dark:border-white/5 dark:bg-white/[0.02]">
                    <TableRow className="border-none">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <TableHead key={i} className="py-4">
                          <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800/50" />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </TableBody>
                </Table>
              </BentoCard>
            </motion.div>
          ) : searchedFor && !error && rows.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 py-20 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.02]"
            >
              <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800/50">
                <Search className="h-8 w-8 text-slate-500 dark:text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-800 dark:text-slate-300">
                No interventions found
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                No courses with intervention records for student {searchedFor}
              </p>
            </motion.div>
          ) : rows.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* ── Bento Stats Grid ── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <BentoCard delay={0} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                        Total Courses
                      </p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        <AnimatedCounter value={rows.length} />
                      </p>
                    </div>
                    <div className="rounded-xl bg-indigo-500/10 p-3">
                      <GraduationCap className="h-5 w-5 text-indigo-400" />
                    </div>
                  </div>
                </BentoCard>

                <BentoCard delay={0.1} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                        Active Interventions
                      </p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-amber-400">
                        <AnimatedCounter value={inProgressCount} />
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-500/10 p-3">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                    </div>
                  </div>
                </BentoCard>

                <BentoCard delay={0.2} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                        Faculties
                      </p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        <AnimatedCounter value={uniqueFaculties} />
                      </p>
                    </div>
                    <div className="rounded-xl bg-violet-500/10 p-3">
                      <Sparkles className="h-5 w-5 text-violet-400" />
                    </div>
                  </div>
                </BentoCard>

                <BentoCard delay={0.3} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                        Latest Update
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {latestIntervention?.latestInterventionAt
                          ? new Date(latestIntervention.latestInterventionAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 p-3">
                      <CalendarDays className="h-5 w-5 text-emerald-400" />
                    </div>
                  </div>
                </BentoCard>
              </div>

              {/* ── Data Table ── */}
              <BentoCard delay={0.4} className="overflow-hidden p-0">
                <div className="border-b border-slate-200 px-6 py-4 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                      Intervention Records
                    </h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-400">
                      {rows.length} results
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-md dark:border-white/5 dark:bg-white/[0.02]">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Faculty
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Department
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Degree
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Course
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Class Type
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Section
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Latest Intervention
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => {
                        const rowId = `${row.courseId}-${row.sectionCode ?? ""}-${row.eventPackageId ?? ""}`;
                        const isExpanded = expandedRow === rowId;

                        return (
                          <motion.tr
                            key={rowId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.4,
                              delay: index * 0.05,
                              ease: [0.23, 1, 0.32, 1],
                            }}
                            className={cn(
                              "group cursor-pointer border-b border-slate-100 transition-colors duration-200 dark:border-white/[0.03]",
                              "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                              isExpanded && "bg-slate-50 dark:bg-white/[0.03]",
                            )}
                            onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                          >
                            <TableCell className="py-4 text-left text-sm text-slate-700 dark:text-slate-300">
                              {row.facultyName || "—"}
                            </TableCell>
                            <TableCell className="py-4 text-left text-sm text-slate-700 dark:text-slate-300">
                              {row.departmentName || "—"}
                            </TableCell>
                            <TableCell className="py-4 text-left text-sm text-slate-700 dark:text-slate-300">
                              {row.degreeTitle || "—"}
                            </TableCell>
                            <TableCell className="py-4 text-left">
                              <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {row.courseId}
                              </div>
                              {row.courseTitle && (
                                <div className="text-xs text-slate-500 dark:text-slate-500">{row.courseTitle}</div>
                              )}
                            </TableCell>
                            <TableCell className="py-4 text-left text-sm text-slate-600 dark:text-slate-400">
                              {row.classType || "N/A"}
                            </TableCell>
                            <TableCell className="py-4 text-left text-sm text-slate-600 dark:text-slate-400">
                              {row.sectionCode || "—"}
                            </TableCell>
                            <TableCell className="py-4 text-left">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                  getStatusBg(row.latestStatus),
                                  getStatusColor(row.latestStatus),
                                )}
                              >
                                {humanizeStatus(row.latestStatus)}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 text-left text-sm text-slate-600 dark:text-slate-400">
                              <div className="flex items-center gap-2">
                                {row.latestInterventionAt
                                  ? new Date(row.latestInterventionAt).toLocaleString()
                                  : "—"}
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDown className="h-3 w-3 text-slate-500 dark:text-slate-600" />
                                </motion.div>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Expanded row details (Progressive Disclosure) */}
                <AnimatePresence>
                  {expandedRow && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden border-t border-slate-200 bg-slate-50/80 dark:border-white/5 dark:bg-white/[0.02]"
                    >
                      {(() => {
                        const row = rows.find(
                          (r) =>
                            `${r.courseId}-${r.sectionCode ?? ""}-${r.eventPackageId ?? ""}` ===
                            expandedRow,
                        );
                        if (!row) return null;
                        return (
                          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
                            <div className="space-y-1">
                              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                                Event Package ID
                              </p>
                              <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                {row.eventPackageId || "—"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                                Raw Status
                              </p>
                              <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                {row.latestStatus || "—"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                                Course Identifier
                              </p>
                              <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{row.courseId}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </BentoCard>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}