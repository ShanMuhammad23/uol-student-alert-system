"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  AlertCircle,
  GraduationCap,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toShortFacultyName } from "@/lib/faculty-name";
import { InterventionStatusBadge } from "./intervention-status-badge";
import { StudentProfileLink } from "@/components/Tables/nested-students-table/StudentProfileLink";

type Row = {
  sapId: string;
  studentName: string;
  courseId: string;
  courseTitle: string | null;
  facultyName: string | null;
  departmentName: string | null;
  degreeTitle: string | null;
  sectionCode: string | null;
  eventPackageId: string | null;
  classType: string;
  alertType: "attendance" | "gpa" | "both" | null;
  latestStatus: string | null;
  latestInterventionAt: string | null;
  teacherName: string | null;
  teacherEmail: string | null;
  teacherPernr: string | null;
  totalClassesHeld: number;
  attendanceMarkedClasses: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaAlertLevel: "warning" | "critical" | null;
};

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
        className
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
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ translateX: ["0%", "200%"] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

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

function SkeletonRow() {
  return (
    <TableRow className="border-slate-200/80 dark:border-white/5">
      {Array.from({ length: 9 }).map((_, i) => (
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
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function InterventionTeacherSearchTab() {
  const [teacherQuery, setTeacherQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const returnToUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const runSearch = async () => {
    const trimmed = teacherQuery.trim();
    if (!trimmed) {
      setError("Enter a teacher name or pernr.");
      setRows([]);
      setSearchedFor(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/interventions/teacher-courses?query=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch teacher interventions");
      }
      const body = (await res.json()) as { rows?: Row[] };
      setRows(Array.isArray(body.rows) ? body.rows : []);
      setSearchedFor(trimmed);
    } catch (e) {
      setRows([]);
      setSearchedFor(trimmed);
      setError(e instanceof Error ? e.message : "Failed to fetch teacher interventions");
    } finally {
      setIsLoading(false);
    }
  };

  const statusCounts = rows.reduce(
    (acc, row) => {
      const status = String(row.latestStatus ?? "").trim().toLowerCase();
      const hasAlert = row.attendanceAlertLevel != null || row.gpaAlertLevel != null;
      if (!status) {
        if (hasAlert) acc.notStarted += 1;
      } else if (status === "initiated") {
        acc.initiated += 1;
      } else if (status === "in-progress") {
        acc.inProgress += 1;
      } else if (status === "referred") {
        acc.referred += 1;
      } else if (status === "resolved") {
        acc.resolved += 1;
      } else {
        acc.other += 1;
      }
      return acc;
    },
    {
      notStarted: 0,
      initiated: 0,
      inProgress: 0,
      referred: 0,
      resolved: 0,
      other: 0,
    }
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800 antialiased selection:bg-indigo-500/30 dark:bg-slate-950 dark:text-slate-200">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[600px] w-[600px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto  space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Instructor Intervention Lookup
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Search and analyze intervention records by instructor name or pernr
          </p>
        </motion.div>

        <MouseSpotlight>
          <div className="relative rounded-2xl border border-slate-200 bg-white/90 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="w-full md:max-w-md">
                <label
                  htmlFor="intervention-search-teacher"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  Instructor Name or Pernr
                </label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="intervention-search-teacher"
                    type="text"
                    value={teacherQuery}
                    onChange={(e) => setTeacherQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void runSearch();
                      }
                    }}
                    placeholder="Enter instructor name or pernr"
                    className={cn(
                      "w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-500",
                      "outline-none transition-all duration-200",
                      "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
                      "backdrop-blur-sm"
                    )}
                  />
                </div>
              </div>
              <MagneticButton
                onClick={() => void runSearch()}
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? "Searching..." : "Search Instructor Interventions"}
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

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <BentoCard className="p-0">
                <Table>
                  <TableHeader className="border-b border-slate-200/80 bg-slate-50/90 dark:border-white/5 dark:bg-white/[0.02]">
                    <TableRow className="border-none">
                      {Array.from({ length: 11 }).map((_, i) => (
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
                <Search className="h-8 w-8 text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-800 dark:text-slate-300">
                No interventions found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                No intervention courses found for {searchedFor}
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Not Started</p>
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-200">
                    {statusCounts.notStarted}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Initiated</p>
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-200">
                    {statusCounts.initiated}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">In-Progress</p>
                  <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                    {statusCounts.inProgress}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Referred</p>
                  <p className="mt-1 text-lg font-bold text-violet-600 dark:text-violet-400">
                    {statusCounts.referred}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Resolved</p>
                  <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {statusCounts.resolved}
                  </p>
                </div>
              </div>

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
                        <TableHead className="min-w-[220px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Student
                        </TableHead>
                        <TableHead className="min-w-[220px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Teacher
                        </TableHead>
                        <TableHead className="min-w-[130px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Faculty
                        </TableHead>
                        <TableHead className="min-w-[180px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Department
                        </TableHead>
                        <TableHead className="min-w-[180px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Degree
                        </TableHead>
                        <TableHead className="min-w-[220px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Course
                        </TableHead>
                        <TableHead className="min-w-[100px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Alert Type
                        </TableHead>
                        <TableHead className="min-w-[100px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Classes Held
                        </TableHead>
                        <TableHead className="min-w-[140px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Attendance %
                        </TableHead>
                        <TableHead className="min-w-[180px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="min-w-[180px] py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Latest Intervention
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => (
                        <motion.tr
                          key={`${row.sapId}-${row.courseId}-${row.sectionCode ?? ""}-${row.eventPackageId ?? ""}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.4,
                            delay: index * 0.05,
                            ease: [0.23, 1, 0.32, 1],
                          }}
                          className="group border-b border-slate-100 transition-colors duration-200 hover:bg-slate-50 dark:border-white/[0.03] dark:hover:bg-white/[0.03]"
                        >
                          <TableCell className="py-4 text-left text-sm text-slate-700 dark:text-slate-300">
                            <StudentProfileLink
                              sapId={row.sapId}
                              returnToUrl={returnToUrl}
                              courseCode={row.courseId}
                              section={row.sectionCode ?? null}
                              eventPackageId={row.eventPackageId ?? null}
                              classAverage={row.classAverageAttendance}
                              className="flex flex-col gap-1"
                              title="View profile"
                            >
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {row.studentName || "—"}
                              </span>
                              <span className="text-xs text-slate-500">SAPID: {row.sapId}</span>
                            </StudentProfileLink>
                          </TableCell>
                          <TableCell className="py-4 text-left text-sm text-slate-700 dark:text-slate-300">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-slate-900 dark:text-white">
                                {row.teacherName || "—"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {row.teacherEmail || "—"}
                              </span>
                              <span className="text-xs text-slate-500">
                                Pernr: {row.teacherPernr || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-left text-sm text-slate-700 dark:text-slate-300">
                            {toShortFacultyName(row.facultyName) ?? "—"}
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
                              <div className="text-xs text-slate-500">{row.courseTitle}</div>
                            )}
                            {row.classType && row.classType !== "N/A" ? (
                              <span className="mt-1 inline-block rounded-md bg-[#1f4a3d] p-1 text-xs font-medium text-white">
                                {row.classType}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-4 text-left text-sm text-slate-600 dark:text-slate-400">
                            {row.alertType === "gpa"
                              ? "GPA"
                              : row.alertType === "both"
                              ? "Both"
                              : row.alertType === "attendance"
                              ? "Attendance"
                              : "—"}
                          </TableCell>
                          <TableCell className="py-4 text-left text-sm text-slate-600 dark:text-slate-400">
                            {row.totalClassesHeld === 0 ? "—" : row.totalClassesHeld}
                          </TableCell>
                          <TableCell className="py-4 text-left">
                            {row.attendancePercentage != null ? (
                              <div className="flex flex-col">
                                <span
                                  className={cn(
                                    row.attendanceAlertLevel === "critical"
                                      ? "text-red-600 dark:text-red-500"
                                      : row.attendanceAlertLevel === "warning"
                                      ? "text-yellow-600 dark:text-yellow-500"
                                      : "text-slate-700 dark:text-slate-300"
                                  )}
                                >
                                  {row.attendancePercentage.toFixed(1)}%
                                  <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                                    ({row.classesAttended}/{row.attendanceMarkedClasses})
                                  </span>
                                </span>
                                {row.classAverageAttendance != null && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Class Avg: {row.classAverageAttendance.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Not Posted
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-left">
                            <InterventionStatusBadge status={row.latestStatus} goodStanding={false} />
                          </TableCell>
                          <TableCell className="py-4 text-left text-sm text-slate-600 dark:text-slate-400">
                            {row.latestInterventionAt
                              ? new Date(row.latestInterventionAt).toLocaleString()
                              : "—"}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </BentoCard>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
