"use client";
import { cn } from "@/lib/utils";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useRef, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { appToast } from "@/components/ui-elements/toast-client";
import { createPortal } from "react-dom";
import type {
  CreateStaffResult,
  StaffFieldValidationResult,
} from "@/app/dashboard/superadmin/staff/create-staff-action";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import {
  FORM_PSEUDO_ROLE_OPTIONS,
  clampActualFormValueToPseudo,
  getActualRoleFormOptionsForPseudo,
  normalizeActualRoleFromForm,
  type StoredPseudoRole,
} from "@/lib/staff-role-rules";
import {
  User,
  Mail,
  Hash,
  Lock,
  Shield,
  Award,
  Building2,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";

type FacultyOption = { id: string; name: string };
type DepartmentOption = { id: string; name: string };

type AddStaffFormProps = {
  createStaff: (formData: FormData) => Promise<CreateStaffResult>;
  validateStaffFields: (
    email: string,
    pernr: string
  ) => Promise<StaffFieldValidationResult>;
  faculties: FacultyOption[];
  departments: DepartmentOption[];
};

/* ──────────────────────────────────────────────
   Magnetic Button Component
   ────────────────────────────────────────────── */
function MagneticButton({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  className,
  isLoading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
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
    const distX = (e.clientX - rect.left - rect.width / 2) * 0.15;
    const distY = (e.clientY - rect.top - rect.height / 2) * 0.15;
    x.set(distX);
    y.set(distY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/10 dark:hover:border-white/20",
    ghost: "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5",
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "relative overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold tracking-tight",
        "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        variants[variant],
        className
      )}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-4 w-4" />
          </motion.div>
        )}
        {children}
      </span>
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ translateX: ["0%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}

/* ──────────────────────────────────────────────
   Form Field Component
   ────────────────────────────────────────────── */
function FormField({
  label,
  required,
  children,
  error,
  warning,
  info,
  success,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string | null;
  warning?: string | null;
  info?: string | null;
  success?: string | null;
  icon?: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className="group flex flex-col gap-2"
    >
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 transition-colors group-focus-within:text-indigo-600 dark:text-slate-400 dark:group-focus-within:text-indigo-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">{children}</div>
      
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-xs font-medium text-red-400"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {error}
          </motion.p>
        )}
        {warning && !error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-400"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {warning}
          </motion.p>
        )}
        {success && !error && !warning && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400"
          >
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            {success}
          </motion.p>
        )}
        {info && !error && !warning && !success && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            {info}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Select Component with Custom Styling
   ────────────────────────────────────────────── */
function PremiumSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  icon: Icon,
  multiple,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  icon?: React.ElementType;
  multiple?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !selectRef.current) return;

    const updateRect = () => {
      const rect = selectRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuRect({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen]);

  return (
    <div ref={selectRef} className="relative">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-200",
          "bg-white backdrop-blur-sm dark:bg-slate-900/50",
          disabled
            ? "cursor-not-allowed border-slate-200 opacity-50 dark:border-white/5"
            : "cursor-pointer border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-slate-800/50",
          "focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20"
        )}
      >
        {Icon && <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
        <span className={cn("flex-1 text-slate-800 dark:text-slate-100", !value && "text-slate-500 dark:text-slate-500")}>
          {value
            ? options.find((o) => o.value === value)?.label ?? placeholder
            : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </div>
      
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && !disabled && menuRect && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                style={{ position: "fixed", top: menuRect.top, left: menuRect.left, width: menuRect.width }}
                className="z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/50"
              >
                {options.map((option, i) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                      "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5",
                      value === option.value && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                    )}
                  >
                    {value === option.value && (
                      <motion.div
                        layoutId="select-indicator"
                        className="h-1.5 w-1.5 rounded-full bg-indigo-400"
                      />
                    )}
                    <span className={cn(!value && option.value === value && "text-indigo-300")}>
                      {option.label}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Password Input with Toggle
   ────────────────────────────────────────────── */
function PasswordInput({ name, placeholder }: { name: string; placeholder: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
      <input
        type={showPassword ? "text" : "password"}
        name={name}
        required
        className={cn(
          "w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600",
          "outline-none transition-all duration-200 backdrop-blur-sm",
          "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
          "hover:border-slate-400 hover:bg-slate-50 dark:hover:border-white/20 dark:hover:bg-slate-800/50"
        )}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Section Header
   ────────────────────────────────────────────── */
function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className="mb-6 space-y-1"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
            <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-slate-600 dark:text-slate-500">{subtitle}</p>}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Main Form Component
   ────────────────────────────────────────────── */
export function AddStaffForm({
  createStaff,
  validateStaffFields,
  faculties,
  departments,
}: AddStaffFormProps) {
  const router = useRouter();
  
  // Form state
  const [name, setName] = useState("");
  const [pseudoRole, setPseudoRole] = useState<StoredPseudoRole | "">("");
  const [actualRole, setActualRole] = useState<string>("");
  const [parentFacultyId, setParentFacultyId] = useState("");
  const [email, setEmail] = useState("");
  const [pernr, setPernr] = useState("");
  
  // Validation state
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pernrError, setPernrError] = useState<string | null>(null);
  const [pernrWarning, setPernrWarning] = useState<string | null>(null);
  const [enrollmentName, setEnrollmentName] = useState<string | null>(null);
  const [nameVariationWarning, setNameVariationWarning] = useState<string | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [pernrChecking, setPernrChecking] = useState(false);
  const [pending, setPending] = useState(false);
  
  const hasPseudoRole = pseudoRole !== "";

  const actualOptions = useMemo(() => {
    if (!pseudoRole) return [];
    return getActualRoleFormOptionsForPseudo(pseudoRole);
  }, [pseudoRole]);

  const showDepartments = pseudoRole === "hod";

  const normalizedName = useCallback((value: string): string => {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }, []);

  async function handleEmailBlur() {
    const value = email.trim().toLowerCase();
    if (!value) {
      setEmailError(null);
      return;
    }
    setEmailChecking(true);
    try {
      const result = await validateStaffFields(value, pernr);
      setEmailError(
        result.emailDuplicate
          ? "This email is already assigned to an existing staff member."
          : null
      );
    } finally {
      setEmailChecking(false);
    }
  }

  async function runPernrLookup(
    pernrValue: string,
    options?: { autoFill?: boolean; notify?: boolean }
  ) {
    const value = pernrValue.trim();
    const autoFill = options?.autoFill ?? false;
    const notify = options?.notify ?? false;

    if (!value) {
      setPernrError(null);
      setPernrWarning(null);
      setEnrollmentName(null);
      setNameVariationWarning(null);
      return;
    }

    setPernrChecking(true);
    try {
      const result = await validateStaffFields(email, value);
      setPernrError(
        result.pernrDuplicate
          ? "This PERNR is already assigned to an existing staff member."
          : null
      );
      setPernrWarning(
        result.pernrInEnrollment === false
          ? "PERNR not found in enrollment data. You can still continue, but this should be reviewed."
          : null
      );
      setEnrollmentName(result.enrollmentInstructorName);

      const instructorName = result.enrollmentInstructorName?.trim() ?? "";
      const instructorEmail = result.enrollmentInstructorEmail?.trim().toLowerCase() ?? "";

      if (autoFill) {
        if (instructorName) {
          setName(instructorName);
          setNameVariationWarning(null);
        }
        if (instructorEmail) {
          const emailCheck = await validateStaffFields(instructorEmail, value);
          setEmail(instructorEmail);
          setEmailError(
            emailCheck.emailDuplicate
              ? "This email is already assigned to an existing staff member."
              : null
          );
        }
        if (notify) {
          if (instructorName || instructorEmail) {
            appToast.success("Staff details loaded from enrollment.", {
              toastId: "staff-pernr-lookup-success",
            });
          } else if (result.pernrInEnrollment === false) {
            appToast.warning("PERNR not found in enrollment data.", {
              toastId: "staff-pernr-lookup-missing",
            });
          }
        }
      } else {
        const typedName = normalizedName(name);
        const dbName = normalizedName(instructorName);
        if (typedName && dbName && typedName !== dbName) {
          setNameVariationWarning(
            `Name variation found: enrollment has "${instructorName}".`
          );
        } else {
          setNameVariationWarning(null);
        }
      }
    } finally {
      setPernrChecking(false);
    }
  }

  async function handlePernrBlur() {
    await runPernrLookup(pernr);
  }

  function handlePernrKeyDown(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    void runPernrLookup(pernr, { autoFill: true, notify: true });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    if (!pseudoRole) {
      appToast.error("Please select a pseudo role first.", {
        toastId: "staff-add-pseudo-required",
      });
      return;
    }
    const normalizedActual = normalizeActualRoleFromForm(actualRole);
    if (!normalizedActual || !actualOptions.some((o) => o.value === actualRole)) {
      appToast.error("Please select a valid actual role for this pseudo role.", {
        toastId: "staff-add-actual-required",
      });
      return;
    }
    if (emailError || pernrError) {
      appToast.error("Please resolve email/PERNR validation errors before submitting.");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData(form);
      formData.set("pseudo_role", pseudoRole);
      formData.set("actual_role", actualRole);

      let result = await createStaff(formData);

      if (!result.ok && result.code === "enrollment_mismatch") {
        const confirmed = window.confirm(
          `${result.message}\n\nDo you want to add this staff member anyway?`
        );
        if (confirmed) {
          formData.set("skip_enrollment_check", "1");
          result = await createStaff(formData);
        } else {
          setPending(false);
          return;
        }
      }

      if (!result.ok) {
        appToast.error(result.message, {
          toastId: `staff-add-error-${result.message}`,
        });
        return;
      }

      appToast.success("Staff added successfully.", {
        toastId: "staff-add-success",
      });
      router.refresh();
      const pwd = form.querySelector<HTMLInputElement>('input[name="password"]');
      if (pwd) pwd.value = "";
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800 antialiased selection:bg-indigo-500/30 dark:bg-slate-950 dark:text-slate-200">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[600px] w-[600px] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto ">
  

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap gap-6"
        >
          {/* Personal Information Section */}
          <div className="relative z-30 rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-md shadow-[0_4px_20px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_20px_rgba(0,0,0,0.3)]">
            <SectionHeader
              title="Personal Information"
              subtitle="Basic staff identification details"
              icon={User}
              delay={0.1}
            />
            
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField label="Full Name" required icon={User} delay={0.15}>
                <div className="relative">
                  <input
                    name="name"
                    required
                    value={name}
                    onChange={(ev) => {
                      const nextName = ev.target.value;
                      setName(nextName);
                      if (!enrollmentName) {
                        setNameVariationWarning(null);
                        return;
                      }
                      const typed = normalizedName(nextName);
                      const fromEnrollment = normalizedName(enrollmentName);
                      if (typed && fromEnrollment && typed !== fromEnrollment) {
                        setNameVariationWarning(
                          `Name variation found: enrollment has "${enrollmentName}".`
                        );
                      } else {
                        setNameVariationWarning(null);
                      }
                    }}
                    className={cn(
                      "w-full rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600",
                      "outline-none transition-all duration-200 backdrop-blur-sm",
                      "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
                      "hover:border-slate-400 hover:bg-slate-50 dark:hover:border-white/20 dark:hover:bg-slate-800/50"
                    )}
                    placeholder="e.g. Dr. Ahmad Hassan"
                  />
                </div>
              </FormField>

              <FormField
                label="Email Address"
                required
                icon={Mail}
                error={emailError}
                info={emailChecking ? "Checking email availability..." : undefined}
                delay={0.2}
              >
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(ev) => {
                      setEmail(ev.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    onBlur={handleEmailBlur}
                    className={cn(
                      "w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600",
                      "outline-none transition-all duration-200 backdrop-blur-sm",
                      "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
                      "hover:border-slate-400 hover:bg-slate-50 dark:hover:border-white/20 dark:hover:bg-slate-800/50",
                      emailError && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                    )}
                    placeholder="name@uol.edu.pk"
                  />
                  {emailChecking && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500 dark:text-slate-400" />
                  )}
                </div>
              </FormField>

              <FormField
                label="PERNR"
                required
                icon={Hash}
                error={pernrError}
                warning={pernrWarning}
                success={enrollmentName ? `Enrollment instructor: ${enrollmentName}` : undefined}
                info="Press Enter to fetch name and email from enrollment data"
                delay={0.25}
              >
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                  <input
                    name="pernr"
                    required
                    value={pernr}
                    onChange={(ev) => {
                      setPernr(ev.target.value);
                      if (pernrError) setPernrError(null);
                      if (pernrWarning) setPernrWarning(null);
                    }}
                    onBlur={handlePernrBlur}
                    onKeyDown={handlePernrKeyDown}
                    className={cn(
                      "w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-600",
                      "outline-none transition-all duration-200 backdrop-blur-sm",
                      "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
                      "hover:border-slate-400 hover:bg-slate-50 dark:hover:border-white/20 dark:hover:bg-slate-800/50",
                      pernrError && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
                      pernrWarning && !pernrError && "border-amber-500/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                    )}
                    placeholder="e.g. 00016932"
                  />
                  {pernrChecking && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500 dark:text-slate-400" />
                  )}
                </div>
              </FormField>

              <FormField label="Password" required icon={Lock} delay={0.3}>
                <PasswordInput name="password" placeholder="Set secure initial password" />
              </FormField>
            </div>

            {nameVariationWarning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Name Mismatch Detected</p>
                    <p className="mt-1 text-xs text-amber-200/70">{nameVariationWarning}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Role Configuration Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-md shadow-[0_4px_20px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_20px_rgba(0,0,0,0.3)]">
            <SectionHeader
              title="Role Configuration"
              subtitle="Define system access level and permissions"
              icon={Shield}
              delay={0.35}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField label="Pseudo Role" required icon={Shield} delay={0.4}>
                <PremiumSelect
                  value={pseudoRole}
                  onChange={(v) => {
                    if (v === "") {
                      setPseudoRole("");
                      setActualRole("");
                      return;
                    }
                    const next = v as StoredPseudoRole;
                    setPseudoRole(next);
                    setActualRole((prev) => clampActualFormValueToPseudo(next, prev));
                  }}
                  options={FORM_PSEUDO_ROLE_OPTIONS.map(({ value, label }) => ({
                    value,
                    label,
                  }))}
                  placeholder="Select pseudo role first"
                  icon={Shield}
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Determines how this account appears in the system hierarchy
                </p>
              </FormField>

              <FormField label="Actual Role" required icon={Award} delay={0.45}>
                <PremiumSelect
                  value={actualRole}
                  onChange={setActualRole}
                  options={actualOptions.map((o) => ({ value: o.value, label: o.label }))}
                  placeholder={!hasPseudoRole ? "Select pseudo role first" : "Select actual role"}
                  disabled={actualOptions.length === 0}
                  icon={Award}
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Defines granular permissions and access controls
                </p>
              </FormField>

              <FormField label="Parent Faculty" required icon={Building2} delay={0.5}>
                <input type="hidden" name="faculty_id" value={parentFacultyId} />
                <PremiumSelect
                  value={parentFacultyId}
                  onChange={setParentFacultyId}
                  options={faculties.map((f) => ({
                    value: f.id,
                    label: resolveFacultyNameFromIdOrName(f.id, f.name) ?? f.name ?? f.id,
                  }))}
                  placeholder="Select parent faculty"
                  icon={Building2}
                />
              </FormField>
            </div>

            <AnimatePresence>
              {showDepartments && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="mt-5 overflow-hidden"
                >
                  <FormField
                    label="HoD Departments"
                    icon={Layers}
                    info="Use Ctrl/Cmd + click to select multiple departments"
                    delay={0}
                  >
                    <select
                      name="department_ids"
                      multiple
                      className={cn(
                        "min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900/50 dark:text-white",
                        "outline-none transition-all duration-200 backdrop-blur-sm",
                        "focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20",
                        "[&_option]:py-2 [&_option]:px-2"
                      )}
                    >
                      {departments.map((department) => (
                        <option
                          key={department.id}
                          value={department.id}
                          className="py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Submit Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55, ease: [0.23, 1, 0.32, 1] }}
            className="relative z-10 flex items-center flex-1 justify-between rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.02]"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Ready to create account?</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All fields marked with * are required for staff creation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <MagneticButton
                variant="secondary"
                onClick={() => router.back()}
              >
                Cancel
              </MagneticButton>
              <MagneticButton
                type="submit"
                variant="primary"
                isLoading={pending}
                disabled={!hasPseudoRole || Boolean(emailError || pernrError)}
              >
                {pending ? "Creating Account..." : "Add Staff Member"}
              </MagneticButton>
            </div>
          </motion.div>
        </motion.form>
      </div>
    </div>
  );
}