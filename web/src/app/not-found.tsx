import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="code text-[#b7a4ff]">404</p>
      <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
      <p className="muted mt-2 text-sm">The route does not exist.</p>
      <Link href="/repairs" className="btn-primary mt-6">
        Back to repairs
      </Link>
    </main>
  );
}
