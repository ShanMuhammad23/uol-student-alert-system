type WellbeingHeadStatCardProps = {
  label: string;
  value: number;
  tone?: "default" | "purple" | "green";
};

export function WellbeingHeadStatCard({
  label,
  value,
  tone = "default",
}: WellbeingHeadStatCardProps) {
  const toneClass =
    tone === "green"
      ? "text-green-600"
      : tone === "purple"
        ? "text-purple-600"
        : "text-dark dark:text-white";
const cardbg = tone === "green" ? "bg-green-50" : tone === "purple" ? "bg-purple-50" : "bg-gray-50";
  return (
    <div className={`rounded-[10px] ${cardbg} p-5 shadow-1 dark:bg-gray-dark dark:shadow-card flex-1`}>
      <p className="text-sm text-dark-5 dark:text-dark-6">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}
