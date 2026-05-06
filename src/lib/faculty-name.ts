const FACULTY_NAME_FALLBACK: Record<string, string> = {
  FAC_ENG: "Faculty of Social Sciences",
  FAC_MGT: "Faculty of Social Sciences",
  "50000172": "Faculty of Social Sciences",
  "50000178": "Faculty of Pharmacy",
  "50000168": "Faculty of Management Sciences",
  "50000169": "Faculty of Arts & Architecture",
  "50000170": "Faculty of Law",
  "50000171": "Faculty of Language & Literature",
  "50000173": "Faculty of Engineering & Technology",
  "50000174": "Faculty of Science",
  "50000175": "Faculty of Information Technology",
  "50000177": "Faculty of Allied Health Sciences",
};

function getFallbackFacultyName(raw: string): string | null {
  if (FACULTY_NAME_FALLBACK[raw]) return FACULTY_NAME_FALLBACK[raw];
  if (/^Faculty\s+\d+$/i.test(raw)) {
    const id = raw.replace(/^Faculty\s+/i, "").trim();
    return FACULTY_NAME_FALLBACK[id] ?? null;
  }
  return null;
}

export function normalizeFacultyName(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return getFallbackFacultyName(raw) ?? raw;
}

export function resolveFacultyNameFromIdOrName(
  facultyId?: string | null,
  facultyName?: string | null
): string | null {
  const normalizedName = normalizeFacultyName(facultyName);
  if (normalizedName && !/^Faculty\s+\d+$/i.test(normalizedName)) {
    return normalizedName;
  }
  const normalizedId = normalizeFacultyName(facultyId);
  if (normalizedId) return normalizedId;
  return normalizedName;
}

export function toShortFacultyName(value?: string | null): string | null {
  const normalized = normalizeFacultyName(value);
  if (!normalized) return null;
  return normalized.replace(/^Faculty of\s+/i, "").trim();
}
