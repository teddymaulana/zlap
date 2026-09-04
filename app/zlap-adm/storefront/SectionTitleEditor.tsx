"use client";

import { useState, useTransition } from "react";
import { updateSectionTitle } from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";

export default function SectionTitleEditor({
  sectionId,
  title,
}: {
  sectionId: "featured_section_1" | "featured_section_2";
  title: string;
}) {
  const [value, setValue] = useState(title);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => updateSectionTitle(sectionId, value));
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border px-2 py-1 text-sm font-semibold"
      />
      <button
        type="submit"
        disabled={isPending}
        className="relative rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Save</span>
        {isPending && <ButtonSpinner className="h-3 w-3" />}
      </button>
    </form>
  );
}
