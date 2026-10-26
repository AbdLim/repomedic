"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel p-8">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="muted mt-2 text-sm">
        The page could not be rendered. Try again.
      </p>
      <button type="button" className="btn-secondary mt-5" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
