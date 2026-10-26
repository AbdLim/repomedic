import { Activity, GitBranch, HeartPulse, Plus, Wrench } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-[#29313c] bg-[#0e1219] p-5 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-r md:border-b-0">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-bold tracking-tight"
        >
          <span className="rounded-lg bg-[#b7a4ff] p-2 text-[#0b0e13]">
            <HeartPulse size={19} />
          </span>
          RepoMedic
        </Link>
        <p className="mt-2 text-xs text-[#929dab]">Autonomous issue repair</p>
        <nav className="mt-9 flex gap-2 md:flex-col">
          <Link href="/" className="btn-secondary justify-start text-sm">
            <Activity size={16} /> Overview
          </Link>
          <Link href="/repairs" className="btn-secondary justify-start text-sm">
            <Wrench size={16} /> Repairs
          </Link>
          <Link
            href="/repairs/new"
            className="btn-secondary justify-start text-sm"
          >
            <Plus size={16} /> New repair
          </Link>
        </nav>
        <div className="mt-8 hidden border-t border-[#29313c] pt-5 text-xs text-[#929dab] md:block">
          <p className="flex items-center gap-2">
            <GitBranch size={14} /> GitHub issue workflow
          </p>
          <p className="mt-2">Review proposed patches before applying them.</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
