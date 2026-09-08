import type { Metadata } from "next";
import { getIdFeaturedSets } from "@/app/actions/storefront";
import FeaturedSetsPage from "../FeaturedSetsPage";

export const metadata: Metadata = {
  title: "Shop by set — Indonesian sets | ZLAP Cards",
  description:
    "Booster boxes from every Indonesian Pokémon expansion ZLAP Cards carries, newest release first.",
};

export default async function IndonesianSetsPage() {
  const sets = await getIdFeaturedSets();

  return (
    <FeaturedSetsPage
      sets={sets}
      eyebrow="Indonesian sets"
      description="Booster boxes from every Indonesian expansion we carry, newest release first."
    />
  );
}
