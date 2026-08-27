"use client";

import { useEffect, useState } from "react";
import { getRegionChildren, type Region } from "@/app/actions/regions";

const SELECT_CLASS =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400";

function RegionSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Region[];
  disabled: boolean;
  onChange: (code: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      required
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">{disabled ? label : `Select ${label}`}</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

// Reports the fully-composed address fragment ("Kelurahan, Kecamatan, Kota,
// Provinsi 12345") once every level plus a valid postal code is selected,
// null otherwise — mirrors how the checkout page previously consumed
// AreaAutocomplete's onChange.
export default function AddressRegionSelect({ onChange }: { onChange: (value: string | null) => void }) {
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);

  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [villageCode, setVillageCode] = useState("");
  const [postalCode, setPostalCode] = useState("");

  useEffect(() => {
    getRegionChildren(null).then(setProvinces);
  }, []);

  // Resetting the downstream selects lives in these handlers (not effects
  // keyed on the parent code) since it's a direct response to the user's
  // selection, not a sync with an external system.
  function handleProvinceChange(code: string) {
    setProvinceCode(code);
    setCityCode("");
    setDistrictCode("");
    setVillageCode("");
    setCities([]);
    setDistricts([]);
    setVillages([]);
    if (code) getRegionChildren(code).then(setCities);
  }

  function handleCityChange(code: string) {
    setCityCode(code);
    setDistrictCode("");
    setVillageCode("");
    setDistricts([]);
    setVillages([]);
    if (code) getRegionChildren(code).then(setDistricts);
  }

  function handleDistrictChange(code: string) {
    setDistrictCode(code);
    setVillageCode("");
    setVillages([]);
    if (code) getRegionChildren(code).then(setVillages);
  }

  useEffect(() => {
    const province = provinces.find((p) => p.code === provinceCode);
    const city = cities.find((c) => c.code === cityCode);
    const district = districts.find((d) => d.code === districtCode);
    const village = villages.find((v) => v.code === villageCode);
    const trimmedPostalCode = postalCode.trim();

    onChange(
      province && city && district && village && /^\d{5}$/.test(trimmedPostalCode)
        ? `${village.name}, ${district.name}, ${city.name}, ${province.name} ${trimmedPostalCode}`
        : null
    );
    // onChange intentionally excluded: the checkout page passes a stable
    // useState setter, and including it here would re-fire on every parent
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceCode, cityCode, districtCode, villageCode, postalCode, provinces, cities, districts, villages]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value="Indonesia"
        disabled
        aria-label="Negara"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
      />
      <RegionSelect
        label="Provinsi"
        value={provinceCode}
        options={provinces}
        disabled={false}
        onChange={handleProvinceChange}
      />
      <RegionSelect
        label="Kota"
        value={cityCode}
        options={cities}
        disabled={!provinceCode}
        onChange={handleCityChange}
      />
      <RegionSelect
        label="Kecamatan"
        value={districtCode}
        options={districts}
        disabled={!cityCode}
        onChange={handleDistrictChange}
      />
      <RegionSelect
        label="Kelurahan"
        value={villageCode}
        options={villages}
        disabled={!districtCode}
        onChange={setVillageCode}
      />
      <input
        type="text"
        inputMode="numeric"
        value={postalCode}
        onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
        placeholder="Kode Pos"
        required
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
