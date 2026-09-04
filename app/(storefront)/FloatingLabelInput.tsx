"use client";

import { useId } from "react";

// Shared with FloatingLabelTextarea — the label is a placeholder-shown
// peer, so both need `placeholder=" "` (not empty) to make the
// `:placeholder-shown` pseudo-class behave, and matching pt/pb to leave
// room for the label once it floats to the top.
export const FLOATING_FIELD_CLASS =
  "peer w-full rounded-lg border border-gray-300 bg-white px-3 pt-5 pb-2 text-sm text-gray-900 placeholder-transparent focus:border-black focus:outline-none disabled:bg-gray-50 disabled:text-gray-400";

export const FLOATING_LABEL_CLASS =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 transition-all duration-150 peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs";

export default function FloatingLabelInput({
  label,
  id: providedId,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="relative">
      <input id={id} placeholder=" " className={FLOATING_FIELD_CLASS} {...props} />
      <label htmlFor={id} className={FLOATING_LABEL_CLASS}>
        {label}
      </label>
    </div>
  );
}
