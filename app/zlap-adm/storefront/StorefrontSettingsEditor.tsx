"use client";

import { useState, useTransition } from "react";
import { updateStorefrontSettings } from "@/app/actions/products";
import ButtonSpinner from "@/app/ButtonSpinner";
import type { StorefrontSettings } from "@/lib/types";

export default function StorefrontSettingsEditor({ settings }: { settings: StorefrontSettings }) {
  const [tagline, setTagline] = useState(settings.header_tagline);
  const [announcements, setAnnouncements] = useState(settings.announcement_messages.join("\n"));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateStorefrontSettings(tagline, announcements);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="header-tagline" className="text-sm font-medium">
          Header tagline
        </label>
        <input
          id="header-tagline"
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="announcement-messages" className="text-sm font-medium">
          Announcement bar messages
        </label>
        <span className="text-xs text-gray-500">One message per line — they rotate in the bar.</span>
        <textarea
          id="announcement-messages"
          value={announcements}
          onChange={(e) => setAnnouncements(e.target.value)}
          rows={4}
          className="rounded border px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="relative self-start rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        <span className={isPending ? "invisible" : ""}>Save</span>
        {isPending && <ButtonSpinner />}
      </button>
    </div>
  );
}
