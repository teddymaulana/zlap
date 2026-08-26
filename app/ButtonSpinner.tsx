// Overlaid on a button's label (which gets `invisible` while pending) rather
// than replacing it, so the button doesn't change width when it starts
// spinning.
export default function ButtonSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
      </svg>
    </span>
  );
}
