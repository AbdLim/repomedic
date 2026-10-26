import { NewRepairForm } from "@/components/repairs/new-repair-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewRepairPage() {
  return (
    <>
      <PageHeader
        title="New repair"
        description="Submit a GitHub issue for investigation and patch verification."
      />
      <NewRepairForm />
    </>
  );
}
