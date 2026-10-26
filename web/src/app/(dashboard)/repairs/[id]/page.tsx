import { RepairDetail } from "@/components/repairs/repair-detail";

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RepairDetail id={id} />;
}
