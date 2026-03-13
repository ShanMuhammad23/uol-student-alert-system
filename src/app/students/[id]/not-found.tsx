import Link from "next/link";

export default function StudentNotFound() {
  return (
    <div className="mx-auto flex max-w-[970px] flex-col items-center justify-center gap-4 py-16 text-center">
      <h2 className="text-heading-6 font-bold text-dark dark:text-white">
        Student not found
      </h2>
      <p className="text-dark-6 dark:text-dark-5">
        The student you’re looking for doesn’t exist or has been removed.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-white hover:bg-primary/90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
