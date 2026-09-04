"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { submitCardRequest } from "@/app/actions/cardRequests";
import { getCurrentCustomer } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";

const PSA_GRADES = ["PSA 10", "PSA 9"];

export default function RequestCardPage() {
  const [cardName, setCardName] = useState("");
  const [cardSet, setCardSet] = useState("");
  const [grade, setGrade] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappOk, setWhatsappOk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getCurrentCustomer().then((customer) => {
      if (!customer) return;
      setName((prev) => prev || customer.name || "");
      setEmail((prev) => prev || customer.email || "");
      setPhone((prev) => prev || customer.phone || "");
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await submitCardRequest({
        cardName,
        setName: cardSet,
        grade,
        referenceUrl,
        notes,
        qty,
        name,
        email,
        phone: whatsappOk ? phone : "",
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10 text-center">
        <div className="mb-2 text-lg font-semibold">Request sent</div>
        <p className="text-sm text-gray-600">
          We&apos;ll email you at <span className="font-medium">{email}</span> with a price quote once we&apos;ve
          sourced it — usually within a day or two.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Keep browsing the catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-1 text-lg font-semibold">Can&apos;t find a card?</h1>
      <p className="mb-6 text-sm text-gray-600">
        Tell us exactly what you&apos;re looking for and we&apos;ll email you a price quote once we&apos;ve sourced
        it.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="Card name (e.g. Charizard VMAX)"
          required
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={cardSet}
          onChange={(e) => setCardSet(e.target.value)}
          placeholder="Set (optional)"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          required
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="" disabled>
            PSA grade
          </option>
          {PSA_GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <p className="-mt-1 text-xs text-gray-500">We&apos;re only taking PSA 9 and PSA 10 requests for now.</p>
        <input
          type="url"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="Reference link or photo URL (optional)"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else we should know? (optional)"
          rows={3}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="request-qty" className="text-sm text-gray-600">
            Qty
          </label>
          <input
            id="request-qty"
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={whatsappOk}
            onChange={(e) => setWhatsappOk(e.target.checked)}
            className="mt-0.5"
          />
          Okay to WhatsApp you if we get news on your request?
        </label>
        {whatsappOk && (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp number"
            required
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="relative rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isSubmitting ? "invisible" : ""}>Send request</span>
          {isSubmitting && <ButtonSpinner />}
        </button>
      </form>
    </div>
  );
}
