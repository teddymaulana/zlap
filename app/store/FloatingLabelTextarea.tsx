"use client";

import { useId } from "react";
import { FLOATING_FIELD_CLASS } from "./FloatingLabelInput";

// Unlike a single-line input, a textarea's content starts at the top-left
// rather than vertically centered, so its label is always pinned small at
// the top instead of animating from a centered "placeholder" position.
const TEXTAREA_LABEL_CLASS = "pointer-events-none absolute left-3 top-2 text-xs text-gray-500";

export default function FloatingLabelTextarea({
  label,
  id: providedId,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="relative">
      <textarea id={id} placeholder=" " className={FLOATING_FIELD_CLASS} {...props} />
      <label htmlFor={id} className={TEXTAREA_LABEL_CLASS}>
        {label}
      </label>
    </div>
  );
}
