export default function PageSpinner({ label, className = "h-8 w-8" }: { label?: string; className?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        className={`animate-spin text-gray-400 ${className}`}
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
      </svg>
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
