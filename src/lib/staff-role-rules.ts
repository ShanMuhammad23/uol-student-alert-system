

export type StoredActualRole =
  | "superadmin"
  | "dean"
  | "hod"
  | "instructor"
  | "wellbeing"
  | "wellbeing-head"
  | "wellbeing-counseller"
  | "admin"
  | "coordinator";

export type StoredPseudoRole =
  | "superadmin"
  | "dean"
  | "hod"
  | "instructor"
  | "wellbeing"
  | "wellbeing-head"
  | "wellbeing-counseller";

/** Single UI/storage bucket for former separate admin + coordinator roles. */
export const FORM_ACTUAL_ADMIN_COORDINATOR = "admin-coordinator" as const;

const STORED_ACTUAL_ROLES: StoredActualRole[] = [
  "superadmin",
  "dean",
  "hod",
  "instructor",
  "wellbeing",
  "wellbeing-head",
  "wellbeing-counseller",
  "admin",
  "coordinator",
];

const STORED_PSEUDO_ROLES: StoredPseudoRole[] = [
  "superadmin",
  "dean",
  "hod",
  "instructor",
  "wellbeing",
  "wellbeing-head",
  "wellbeing-counseller",
];

/** Pseudo roles shown first when adding/editing staff (pick pseudo → then actual). */
export const FORM_PSEUDO_ROLE_OPTIONS: { value: StoredPseudoRole; label: string }[] =
  STORED_PSEUDO_ROLES.map((value) => ({ value, label: value.replaceAll("-", " ") }));

/** Full actual-role form options (labels); subsets are returned per pseudo via {@link getActualRoleFormOptionsForPseudo}. */
export const FORM_ACTUAL_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "superadmin", label: "superadmin" },
  { value: FORM_ACTUAL_ADMIN_COORDINATOR, label: "admin / coordinator" },
  { value: "dean", label: "dean" },
  { value: "hod", label: "hod" },
  { value: "instructor", label: "instructor" },
  { value: "wellbeing", label: "wellbeing" },
  { value: "wellbeing-head", label: "wellbeing-head" },
  { value: "wellbeing-counseller", label: "wellbeing-counseller" },
];

export function isStoredActualRole(s: string): s is StoredActualRole {
  return STORED_ACTUAL_ROLES.includes(s as StoredActualRole);
}

export function isStoredPseudoRole(s: string): s is StoredPseudoRole {
  return STORED_PSEUDO_ROLES.includes(s as StoredPseudoRole);
}

export function normalizeActualRoleFromForm(raw: string): StoredActualRole | null {
  const t = raw.trim();
  if (t === FORM_ACTUAL_ADMIN_COORDINATOR) return "admin";
  return isStoredActualRole(t) ? t : null;
}

/** Map DB value → form select value (for edit screens). */
export function storedActualRoleToFormValue(
  stored: string | null | undefined
): string {
  if (stored === "admin" || stored === "coordinator") {
    return FORM_ACTUAL_ADMIN_COORDINATOR;
  }
  return String(stored ?? "").trim();
}

/** DB `actual_role` values allowed for a chosen pseudo role (pseudo-first rules). */
export function getAllowedStoredActualRolesForPseudo(
  pseudo: StoredPseudoRole
): StoredActualRole[] {
  switch (pseudo) {
    case "dean":
    case "hod":
      return ["admin", "coordinator", "dean", "hod"];
    case "superadmin":
      return ["superadmin"];
    case "wellbeing-head":
      return ["wellbeing-head"];
    case "wellbeing-counseller":
      return ["wellbeing-counseller"];
    case "instructor":
      return ["instructor"];
    case "wellbeing":
      return ["wellbeing"];
    default:
      return [];
  }
}

/** Form dropdown entries for “Actual role” after pseudo is chosen. */
export function getActualRoleFormOptionsForPseudo(
  pseudo: StoredPseudoRole
): { value: string; label: string }[] {
  switch (pseudo) {
    case "dean":
    case "hod":
      return [
        { value: FORM_ACTUAL_ADMIN_COORDINATOR, label: "admin / coordinator" },
        { value: "dean", label: "dean" },
        { value: "hod", label: "hod" },
      ];
    case "superadmin":
      return [{ value: "superadmin", label: "superadmin" }];
    case "wellbeing-head":
      return [{ value: "wellbeing-head", label: "wellbeing-head" }];
    case "wellbeing-counseller":
      return [{ value: "wellbeing-counseller", label: "wellbeing-counseller" }];
    case "instructor":
      return [{ value: "instructor", label: "instructor" }];
    case "wellbeing":
      return [{ value: "wellbeing", label: "wellbeing" }];
    default:
      return [];
  }
}

/** If current form value is invalid for pseudo, return first allowed form value. */
export function clampActualFormValueToPseudo(
  pseudo: StoredPseudoRole,
  actualFormValue: string
): string {
  const opts = getActualRoleFormOptionsForPseudo(pseudo);
  if (opts.some((o) => o.value === actualFormValue)) return actualFormValue;
  return opts[0]?.value ?? actualFormValue;
}

export function isValidStaffActualPseudoPair(
  actual: StoredActualRole,
  pseudo: StoredPseudoRole
): boolean {
  return getAllowedStoredActualRolesForPseudo(pseudo).includes(actual);
}

export function staffRolePairErrorMessage(
  actual: StoredActualRole,
  pseudo: StoredPseudoRole
): string | null {
  if (isValidStaffActualPseudoPair(actual, pseudo)) return null;
  switch (pseudo) {
    case "dean":
    case "hod":
      return "For dean or HoD pseudo role, actual role must be admin/coordinator, dean, or HoD.";
    case "superadmin":
      return "For superadmin pseudo role, actual role must be superadmin.";
    case "wellbeing-head":
      return "For wellbeing-head pseudo role, actual role must be wellbeing-head.";
    case "wellbeing-counseller":
      return "For wellbeing-counseller pseudo role, actual role must be wellbeing-counseller.";
    case "instructor":
      return "For instructor pseudo role, actual role must be instructor.";
    case "wellbeing":
      return "For wellbeing pseudo role, actual role must be wellbeing.";
    default:
      return "This actual role is not allowed for the selected pseudo role.";
  }
}

export function formatActualRoleDisplay(stored: string | null | undefined): string {
  if (stored === "admin" || stored === "coordinator") {
    return "admin / coordinator";
  }
  if (!stored) return "—";
  return stored.replaceAll("-", " ");
}
