import type { Metadata } from "next";
import { getEnFeaturedSets } from "@/app/actions/storefront";
import FeaturedSetsPage from "../FeaturedSetsPage";

export const metadata: Metadata = {
  title: "Shop by set — English sets | ZLAP Cards",
  description:
    "Elite Trainer Boxes from every English Pokémon expansion ZLAP Cards carries, newest release first.",
};

export default async function EnglishSetsPage() {
  const sets = await getEnFeaturedSets();

  return (
    <FeaturedSetsPage
      sets={sets}
      eyebrow="English sets"
      description="Elite Trainer Boxes from every English expansion we carry, newest release first."
    />
  );
}
