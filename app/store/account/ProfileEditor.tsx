"use client";

import { useState, useTransition } from "react";
import { updateCustomerProfile, updateCustomerPassword, type CustomerProfile } from "@/app/actions/customer";
import ButtonSpinner from "@/app/ButtonSpinner";

const inputClass = "rounded border px-3 py-2 text-sm";

export default function ProfileEditor({ customer }: { customer: CustomerProfile }) {
  const [name, setName] = useState(customer.name ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    startProfileTransition(async () => {
      const result = await updateCustomerProfile({ name, phone, email });
      if (result.error) setProfileError(result.error);
      else setProfileSaved(true);
    });
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    startPasswordTransition(async () => {
      const result = await updateCustomerPassword({ currentPassword, newPassword });
      if (result.error) {
        setPasswordError(result.error);
      } else {
        setPasswordSaved(true);
        setCurrentPassword("");
        setNewPassword("");
      }
    });
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <form onSubmit={submitProfile} className="flex flex-col gap-2 rounded border p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Profile</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
          className={inputClass}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className={inputClass}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number (optional)"
          className={inputClass}
        />
        {profileError && <p className="text-sm text-red-600">{profileError}</p>}
        {profileSaved && <p className="text-sm text-green-700">Profile updated.</p>}
        <button
          type="submit"
          disabled={isProfilePending}
          className="relative mt-1 self-start rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isProfilePending ? "invisible" : ""}>Save changes</span>
          {isProfilePending && <ButtonSpinner />}
        </button>
      </form>

      <form onSubmit={submitPassword} className="flex flex-col gap-2 rounded border p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Change password</h3>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          required
          className={inputClass}
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          required
          minLength={8}
          className={inputClass}
        />
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
        {passwordSaved && <p className="text-sm text-green-700">Password updated.</p>}
        <button
          type="submit"
          disabled={isPasswordPending}
          className="relative mt-1 self-start rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <span className={isPasswordPending ? "invisible" : ""}>Update password</span>
          {isPasswordPending && <ButtonSpinner />}
        </button>
      </form>
    </div>
  );
}
