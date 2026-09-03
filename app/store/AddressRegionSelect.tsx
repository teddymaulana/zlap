"use client";

import { useEffect, useRef, useState } from "react";
import { getRegionChildren, type Region } from "@/app/actions/regions";
import FloatingLabelInput from "./FloatingLabelInput";

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onOutside]);
  return ref;
}

// Search-as-you-type suggestions filtered from the already-fetched child
// list (at most a few dozen options per level), rather than a remote
// search — so no debounce is needed, just local filtering.
//
// The parent gives each of these a `key` tied to its own parent's code
// (e.g. Kota is keyed on provinceCode) so picking a new Provinsi remounts
// Kota/Kecamatan/Kelurahan fresh instead of needing an effect to reconcile
// stale query text against a reset value.
function RegionCombobox({
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
  const selectedName = options.find((o) => o.code === value)?.name ?? "";
  const [query, setQuery] = useState(selectedName);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useClickOutside(() => setIsOpen(false));

  const trimmed = query.trim().toLowerCase();
  // Focusing an empty field shows the full list (nothing typed yet to
  // filter by); once the customer types, narrow to matches and cap the
  // count so the dropdown stays scannable.
  const results = !isOpen
    ? []
    : !trimmed
      ? options
      : trimmed === selectedName.toLowerCase()
        ? []
        : options.filter((o) => o.name.toLowerCase().includes(trimmed)).slice(0, 8);

  function select(option: Region) {
    setQuery(option.name);
    onChange(option.code);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <FloatingLabelInput
        type="text"
        label={label}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        autoComplete="off"
        required
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow">
          {results.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => select(o)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
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
      <FloatingLabelInput type="text" label="Negara" value="Indonesia" disabled readOnly />
      <RegionCombobox
        label="Provinsi"
        value={provinceCode}
        options={provinces}
        disabled={false}
        onChange={handleProvinceChange}
      />
      <RegionCombobox
        key={`city-${provinceCode}`}
        label="Kota"
        value={cityCode}
        options={cities}
        disabled={!provinceCode}
        onChange={handleCityChange}
      />
      <RegionCombobox
        key={`district-${cityCode}`}
        label="Kecamatan"
        value={districtCode}
        options={districts}
        disabled={!cityCode}
        onChange={handleDistrictChange}
      />
      <RegionCombobox
        key={`village-${districtCode}`}
        label={cities.find((c) => c.code === cityCode)?.name.startsWith("Kabupaten") ? "Desa" : "Kelurahan"}
        value={villageCode}
        options={villages}
        disabled={!districtCode}
        onChange={setVillageCode}
      />
      <FloatingLabelInput
        type="text"
        inputMode="numeric"
        label="Kode Pos"
        value={postalCode}
        onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
        required
      />
    </div>
  );
}
