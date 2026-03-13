"use client";

import React, { useId, useState } from "react";
import { ChevronUpIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const OUTREACH_MODES = [
  { value: "email", label: "Email" },
  { value: "phone-call", label: "Phone Call" },
  { value: "meeting", label: "Meeting" },
  { value: "flagged" , label: "Flagged"}
] as const;

const STATUS_OPTIONS = [
  { value: "initiated", label: "Initiated" },
  { value: "in-progress", label: "In-Progress" },
  { value: "referred", label: "Referred" },
  { value: "resolved", label: "Resolved" },
] as const;

export type InterventionFormData = {
  date: string;
  outreachMode: string;
  remarks: string;
  status: string;
};

type InterventionFormProps = {
  onSubmit?: (data: InterventionFormData) => void;
  onCancel?: () => void;
  className?: string;
};

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  items,
  required,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  items: { value: string; label: string }[];
  required?: boolean;
  id: string;
}) {
  const isSelected = value !== "";
  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="block text-body-sm font-medium text-dark dark:text-white"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={cn(
            "w-full appearance-none rounded-lg border border-stroke bg-transparent px-5.5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary [&>option]:text-dark-5 dark:[&>option]:text-dark-6",
            isSelected && "text-dark dark:text-white",
          )}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronUpIcon className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rotate-180" />
      </div>
    </div>
  );
}

const InterventionForm = ({
  onSubmit,
  onCancel,
  className,
}: InterventionFormProps) => {
  const dateId = useId();
  const outreachId = useId();
  const statusId = useId();

  const [date, setDate] = useState("");
  const [outreachMode, setOutreachMode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    setIsAdding(true);
    e.preventDefault();
    onSubmit?.({
      date,
      outreachMode,
      remarks,
      status,
    });
    setIsAdding(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-5", className)}>
      {/* 1. Date */}
      <div>
        <label
          htmlFor={dateId}
          className="mb-3 block text-body-sm font-medium text-dark dark:text-white"
        >
          Date
        </label>
        <input
          id={dateId}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary active:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
        />
      </div>

      {/* 2. Outreach Mode */}
      <SelectField
        id={outreachId}
        label="Mode"
        placeholder="Select mode"
        value={outreachMode}
        onChange={setOutreachMode}
        items={OUTREACH_MODES.map((o) => ({ value: o.value, label: o.label }))}
        required
      />

      {/* 3. Remarks */}
      <div>
        <label className="mb-3 block text-body-sm font-medium text-dark dark:text-white">
          Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          placeholder="Enter remarks..."
          className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary placeholder:text-dark-6"
        />
      </div>

      {/* 4. Status */}
      <SelectField
        id={statusId}
        label="Status"
        placeholder="Select status"
        value={status}
        onChange={setStatus}
        items={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        required
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2.5 rounded-[5px] bg-primary py-3.5 px-10 text-center font-medium text-white transition hover:bg-opacity-90 focus:outline-none lg:px-8 xl:px-10"
        >
          {isAdding ? "Adding..." : "Add Intervention"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2.5 rounded-[5px] border border-dark py-3.5 px-10 text-center font-medium text-dark transition hover:bg-dark/10 focus:outline-none dark:border-white/25 dark:text-white dark:hover:bg-white/10 lg:px-8 xl:px-10"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default InterventionForm;
