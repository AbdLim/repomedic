import { RepairList } from "@/components/repairs/repair-list";
import { PageHeader } from "@/components/ui/page-header";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function RepairsPage() {
  return (
    <>
      <PageHeader
        title="Repairs"
        description="Track investigations, patches, and verification results."
        action={
          <Link href="/repairs/new" className="btn-primary text-sm">
            <Plus size={16} /> New repair
          </Link>
        }
      />
      <RepairList />
    </>
  );
}
