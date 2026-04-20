"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { UploadIcon } from "@/assets/icons";
import type { StaffProfileView } from "@/lib/db";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CameraIcon } from "./_components/icons";

function profileImageSrc(img: string | null | undefined): string {
  if (!img) return "/images/user/user-placeholder.jpg";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return `/images/${img}`;
}

function formatRole(role: string): string {
  if (role === "instructor") return "Instructor";
  return role.replace(/_/g, " ");
}
type Props = {
  initialProfile: StaffProfileView | null;
};

export function ProfileView({ initialProfile }: Props) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<StaffProfileView | null>(initialProfile);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [pwBusy, setPwBusy] = useState(false);
  const [profileReady, setProfileReady] = useState(!!initialProfile);

  const refreshProfile = useCallback(async () => {
    const r = await fetch("/api/profile");
    if (!r.ok) {
      setProfileReady(true);
      return;
    }
    const data = (await r.json()) as StaffProfileView;
    setProfile(data);
    setProfileReady(true);
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const displayImg = profileImageSrc(profile?.img ?? session?.user?.img ?? null);

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = (await r.json()) as { ok?: boolean; img?: string; error?: string };
      if (!r.ok) {
        alert(data.error ?? "Upload failed.");
        return;
      }
      if (data.img) {
        await update({ img: data.img });
        router.refresh();
        await refreshProfile();
      }
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (pwNew !== pwConfirm) {
      setPwMessage({ type: "err", text: "New password and confirmation do not match." });
      return;
    }
    setPwBusy(true);
    try {
      const r = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNew,
        }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) {
        setPwMessage({ type: "err", text: data.error ?? "Could not update password." });
        return;
      }
      setPwMessage({ type: "ok", text: "Password updated." });
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } finally {
      setPwBusy(false);
    }
  }

  const p = profile;
  const name = p?.name ?? session?.user?.name ?? "—";
  const email = p?.email ?? session?.user?.email ?? "—";
  const pernr = p?.pernr ?? session?.user?.pernr ?? "—";
  const roleLabel = p ? formatRole(p.role) : formatRole(session?.user?.role ?? "");

  return (
    <div className="mx-auto w-full max-w-[970px]">
      <Breadcrumb pageName="Profile" />

      <div className="grid gap-8">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#1f4a3d] via-[#255a4a] to-[#1f4a3d] shadow-lg">
          <div className="relative px-6 py-8 sm:px-8">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white blur-3xl" />
            </div>
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex-1 text-white">
                <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
                <div className="mt-1 text-base text-white/90">{email}</div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-white">
                  <span className="flex flex-col gap-1.5 border-r border-white/20 pr-4">
                    <span className="text-base">PERNR:</span>
                    <span className="font-medium">{pernr}</span>
                  </span>
                  <span className="flex flex-col gap-1.5 border-r border-white/20 pr-4">
                    <span className="text-base">Role:</span>
                    <span className="font-medium uppercase tracking-wide">{roleLabel}</span>
                  </span>
                  <span className="flex flex-col gap-1.5 border-r border-white/20 pr-4">
                    <span className="text-base">Faculty:</span>
                    <span className="font-medium">
                      {resolveFacultyNameFromIdOrName(p?.faculty_id, p?.faculty_name) ?? "—"}
                    </span>
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="text-base">Departments:</span>
                    <span className="font-medium">
                      {p?.department_names?.length ? p.department_names.join(", ") : "—"}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <div className="relative">
                  <Image
                    src={displayImg}
                    width={120}
                    height={120}
                    className="size-[120px] rounded-full border border-white/30 object-cover"
                    alt=""
                    unoptimized={displayImg.startsWith("http")}
                  />
                  <label
                    className="absolute bottom-0 right-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-opacity-90 disabled:opacity-50"
                    title="Change photo"
                  >
                    <CameraIcon className="size-4" />
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={avatarBusy}
                      onChange={onAvatarChange}
                    />
                  </label>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-body-sm font-medium text-white transition hover:bg-white/20">
                  <UploadIcon />
                  <span>Upload picture</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={avatarBusy}
                    onChange={onAvatarChange}
                  />
                </label>
                <p className="text-xs text-white/80">JPEG/PNG/WebP, up to 2 MB</p>
              </div>
            </div>
          </div>
        </div>

        <ShowcaseSection title="Account details" className="!p-6 sm:!p-8">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-body-sm text-dark-6 dark:text-dark-5">Name</dt>
              <dd className="font-medium text-dark dark:text-white">{name}</dd>
            </div>
            <div>
              <dt className="text-body-sm text-dark-6 dark:text-dark-5">Email</dt>
              <dd className="font-medium text-dark dark:text-white">{email}</dd>
            </div>
            <div>
              <dt className="text-body-sm text-dark-6 dark:text-dark-5">Personnel number</dt>
              <dd className="font-medium text-dark dark:text-white">{pernr}</dd>
            </div>
            <div>
              <dt className="text-body-sm text-dark-6 dark:text-dark-5">Role</dt>
              <dd className="font-medium uppercase tracking-wide text-primary">{roleLabel}</dd>
            </div>
            {p?.faculty_name && (
              <div className="sm:col-span-2">
                <dt className="text-body-sm text-dark-6 dark:text-dark-5">Faculty</dt>
                <dd className="font-medium text-dark dark:text-white">{p.faculty_name}</dd>
              </div>
            )}
            {p?.department_names && p.department_names.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-body-sm text-dark-6 dark:text-dark-5">Departments</dt>
                <dd className="font-medium text-dark dark:text-white">
                  {p.department_names.join(", ")}
                </dd>
              </div>
            )}
            {p?.created_at && (
              <div>
                <dt className="text-body-sm text-dark-6 dark:text-dark-5">Record created</dt>
                <dd className="font-medium text-dark dark:text-white">
                  {new Date(p.created_at).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </ShowcaseSection>

        <ShowcaseSection title="Change password" className="!p-6 sm:!p-8">
          {!profileReady ? (
            <p className="text-body-sm text-dark-6 dark:text-dark-5">Loading…</p>
          ) : !p ? (
            <p className="text-body-sm text-dark-6 dark:text-dark-5">
              Profile could not be loaded. Ensure the database is configured and try again.
            </p>
          ) : !p.has_password ? (
            <p className="text-body-sm text-dark-6 dark:text-dark-5">
              No password is stored for this account (for example, you may use Google sign-in).
              Password change is not available here.
            </p>
          ) : (
            <form onSubmit={onPasswordSubmit} className="max-w-md space-y-4">
              {pwMessage && (
                <p
                  className={
                    pwMessage.type === "ok"
                      ? "text-sm text-green-600 dark:text-green-400"
                      : "text-sm text-red"
                  }
                  role="status"
                >
                  {pwMessage.text}
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-dark dark:text-white">
                  Current password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-dark dark:text-white">
                  New password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-dark dark:text-white">
                  Confirm new password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={pwBusy}
                className="rounded-lg bg-primary px-6 py-2.5 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
              >
                {pwBusy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </ShowcaseSection>
      </div>
    </div>
  );
}
