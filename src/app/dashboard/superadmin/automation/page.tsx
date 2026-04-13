import { AutomationPanel } from "../_components/AutomationPanel";

export default function SuperadminAutomationPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
          Automation
        </h1>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Run ETL and monitor automation logs.
        </p>
      </div>
      <AutomationPanel showLogs />
    </div>
  );
}

