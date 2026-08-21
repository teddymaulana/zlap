import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-200 via-rose-200 to-indigo-200 opacity-40 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-6">
        <span className="text-sm font-semibold tracking-[0.3em] text-gray-400 uppercase">
          Zlap
        </span>

        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          Something great is coming.
        </h1>

        <p className="max-w-md text-base text-gray-500 sm:text-lg">
          Our storefront for graded cards, booster boxes, and collectibles
          is on its way. Check back soon.
        </p>
      </div>

      <Link
        href="/login"
        className="absolute bottom-8 text-xs text-gray-300 hover:text-gray-500"
      >
        Staff sign in
      </Link>
    </div>
  );
}
