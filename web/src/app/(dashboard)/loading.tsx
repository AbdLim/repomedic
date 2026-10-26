export default function Loading() {
  return (
    <div className="space-y-4" aria-label="Loading page">
      <div className="h-8 w-56 animate-pulse rounded bg-[#19202b]" />
      <div className="h-40 animate-pulse rounded-xl bg-[#19202b]" />
      <div className="h-64 animate-pulse rounded-xl bg-[#19202b]" />
    </div>
  );
}
