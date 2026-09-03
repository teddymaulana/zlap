import { copy } from "@/lib/copy";

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-lg font-semibold">{copy.terms.pageTitle}</h1>
      <p className="mb-8 text-xs text-gray-400">{copy.terms.lastUpdated}</p>

      <div className="flex flex-col gap-8">
        {copy.terms.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="mb-2 text-sm font-semibold text-black">{section.heading}</h2>
            {section.items ? (
              <div className="flex flex-col gap-3">
                {section.items.map((item) => (
                  <div key={item.title}>
                    <h3 className="mb-1 text-sm font-medium text-black">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">{section.body}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
