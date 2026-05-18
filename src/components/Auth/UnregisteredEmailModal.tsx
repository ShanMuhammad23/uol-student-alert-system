"use client";

type UnregisteredEmailModalProps = {
  email: string;
  open: boolean;
  onClose: () => void;
};

export function UnregisteredEmailModal({
  email,
  open,
  onClose,
}: UnregisteredEmailModalProps) {
  if (!open) return null;

  const displayEmail = email.trim() || "your email";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-dark/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unregistered-email-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="unregistered-email-title"
          className="text-center text-base leading-relaxed text-dark dark:text-white"
        >
          Your email{" "}
          <span className="font-semibold">({displayEmail})</span> is not
          registered on this portal.
        </p>
        <div>
          <p className="text-md text-bold  dark:text-dark-6 underline text-primary">How to get access?</p>
          <p className="text-sm text-dark-5 dark:text-dark-6">
            Please send an email to <a href="mailto:shan.muhammad@spmo.uol.edu.pk" className="text-primary hover:underline">shan.muhammad@spmo.uol.edu.pk</a> <br /> or WhatsApp on <a href="https://wa.me/923219720819" className="text-primary hover:underline">03219720819</a> by attaching the following info:
            <ul className="list-disc list-inside">
              <li>Name</li>
              <li>Official Email Address</li>
              <li>SAPID</li>
              <li>Role: (Dean, HoD, Instructor,Wellbeing,Admin/Coordinator)</li>
              <li>Faculty,Department</li>
            </ul>
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
