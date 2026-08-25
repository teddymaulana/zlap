"use client";

import { useEffect, useState } from "react";
import { trackShipment, type TrackingResult } from "@/app/actions/tracking";
import { getRecommendedProducts, type StorefrontProduct } from "@/app/actions/storefront";
import ProductCard from "../ProductCard";

function initialAwb() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("awb") ?? "";
}

export default function TrackPage() {
  const [awb, setAwb] = useState(initialAwb);
  const [result, setResult] = useState<TrackingResult | { error: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recommended, setRecommended] = useState<StorefrontProduct[]>([]);

  useEffect(() => {
    getRecommendedProducts().then(setRecommended);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = awb.trim();
    const url = trimmed ? `/store/track?awb=${encodeURIComponent(trimmed)}` : "/store/track";
    window.history.replaceState(null, "", url);
    if (!trimmed) {
      setResult(null);
      return;
    }
    setIsSearching(true);
    try {
      setResult(await trackShipment(trimmed));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-lg font-semibold">Track your order</h1>
      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          type="text"
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          placeholder="Enter AWB / resi number"
          className="flex-1 rounded border px-4 py-3 text-base"
        />
        <button
          type="submit"
          className="rounded bg-black px-5 py-3 text-sm font-medium text-white"
        >
          Track
        </button>
      </form>

      {isSearching ? (
        <p className="text-sm text-gray-500">Checking status…</p>
      ) : result && "error" in result ? (
        <p className="text-sm text-gray-500">{result.error}</p>
      ) : result ? (
        <div className="rounded border p-4">
          <div className="mb-3 text-sm font-medium">{result.status}</div>
          <ul className="flex flex-col gap-2">
            {result.events.map((ev, i) => (
              <li key={i} className="text-sm">
                <span className="text-gray-500">{ev.date}</span> — {ev.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommended.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recommended.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
