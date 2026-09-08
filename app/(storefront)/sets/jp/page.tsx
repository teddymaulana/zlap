import type { Metadata } from "next";
import { getJpFeaturedSets } from "@/app/actions/storefront";
import FeaturedSetsPage from "../FeaturedSetsPage";

export const metadata: Metadata = {
  title: "Shop by set — Japanese sets | ZLAP Cards",
  description:
    "Booster boxes from every Japanese Pokémon expansion ZLAP Cards carries, newest release first.",
};

export default async function JapaneseSetsPage() {
  const sets = await getJpFeaturedSets();

  return (
    <FeaturedSetsPage
      sets={sets}
      eyebrow="Japanese sets"
      description="Booster boxes from every Japanese expansion we carry, newest release first."
    />
  );
}
