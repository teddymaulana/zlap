import { copy } from "@/lib/copy";

const CONTACT_EMAIL = "info@zlapcard.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-lg font-semibold">{copy.privacy.pageTitle}</h1>
      <p className="mb-8 text-sm text-gray-600">{copy.privacy.intro}</p>

      <h2 className="mb-2 text-sm font-semibold text-black">{copy.privacy.collectHeading}</h2>
      <p className="mb-2 text-sm text-gray-600">{copy.privacy.collectIntro}</p>
      <ul className="mb-8 list-disc space-y-1 pl-5 text-sm text-gray-600">
        {copy.privacy.collectItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-semibold text-black">{copy.privacy.useHeading}</h2>
      <p className="mb-2 text-sm text-gray-600">{copy.privacy.useIntro}</p>
      <ul className="mb-8 list-disc space-y-1 pl-5 text-sm text-gray-600">
        {copy.privacy.useItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="mb-2 text-sm text-gray-600">{copy.privacy.noShareNote}</p>
      <p className="text-sm text-gray-600">
        {copy.privacy.preferencesNote}{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-black underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
