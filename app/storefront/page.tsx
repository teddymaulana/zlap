import { createClient } from "@/lib/supabase/server";
import type {
  PopularKeyword,
  Product,
  StorefrontSection,
  StorefrontSettings,
  StorefrontShortcut,
} from "@/lib/types";
import { getCardSets } from "@/app/actions/sets";
import FeaturedOrderList from "./FeaturedOrderList";
import AddToSection from "./AddToSection";
import SectionTitleEditor from "./SectionTitleEditor";
import KeywordManager from "./KeywordManager";
import ShortcutManager from "./ShortcutManager";
import StorefrontSettingsEditor from "./StorefrontSettingsEditor";

export default async function StorefrontSettingsPage() {
  const supabase = await createClient();
  const [
    { data: allProducts, error },
    { data: sections, error: sectionsError },
    { data: keywords, error: keywordsError },
    { data: settingsRow, error: settingsError },
    { data: shortcuts, error: shortcutsError },
    sets,
  ] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("storefront_sections").select("*"),
    supabase.from("popular_keywords").select("*").order("created_at", { ascending: true }),
    supabase.from("storefront_settings").select("*").eq("id", 1).single(),
    supabase.from("storefront_shortcuts").select("*").order("created_at", { ascending: true }),
    getCardSets(),
  ]);
  if (error) throw new Error(error.message);
  if (sectionsError) throw new Error(sectionsError.message);
  if (keywordsError) throw new Error(keywordsError.message);
  if (settingsError) throw new Error(settingsError.message);
  if (shortcutsError) throw new Error(shortcutsError.message);

  const products = (allProducts ?? []) as Product[];
  const sectionTitles = new Map((sections as StorefrontSection[] | null)?.map((s) => [s.id, s.title]));

  const sectionConfigs = [
    {
      id: "featured_section_1" as const,
      title: sectionTitles.get("featured_section_1") ?? "Section 1",
      list: products
        .filter((p) => p.featured_section_1)
        .sort((a, b) => (a.featured_section_1_order ?? 0) - (b.featured_section_1_order ?? 0)),
    },
    {
      id: "featured_section_2" as const,
      title: sectionTitles.get("featured_section_2") ?? "Section 2",
      list: products
        .filter((p) => p.featured_section_2)
        .sort((a, b) => (a.featured_section_2_order ?? 0) - (b.featured_section_2_order ?? 0)),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Storefront settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose which products show in the storefront&apos;s featured carousels.
        </p>
      </div>

      <div className="mb-10">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Header &amp; announcement bar</h2>
        <StorefrontSettingsEditor settings={settingsRow as StorefrontSettings} />
      </div>

      {sectionConfigs.map((section) => {
        const candidates = products
          .filter((p) => !p[section.id])
          .map((p) => ({ id: p.id, name: p.name, sku: p.sku }));

        return (
          <div key={section.id} className="mb-10">
            <div className="mb-2 flex items-center justify-between">
              <SectionTitleEditor sectionId={section.id} title={section.title} />
              <span className="text-sm text-gray-500">{section.list.length}/8 selected</span>
            </div>
            <FeaturedOrderList section={section.id} products={section.list} />
            <AddToSection section={section.id} candidates={candidates} />
          </div>
        );
      })}

      <div className="mb-10">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Homepage shortcuts</h2>
        <p className="mb-3 text-sm text-gray-500">
          The row of tiles under the storefront search box. Each can link to a category
          filter, a single product, a search query, or any other link.
        </p>
        <ShortcutManager
          shortcuts={(shortcuts ?? []) as StorefrontShortcut[]}
          products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
          sets={sets}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Popular search keywords</h2>
        <KeywordManager keywords={(keywords ?? []) as PopularKeyword[]} />
      </div>
    </div>
  );
}
