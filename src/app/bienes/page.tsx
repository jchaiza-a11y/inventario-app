import { BienesTable } from "@/components/bienes-table";

export default function BienesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bienes</h1>
        <p className="text-sm text-muted-foreground">
          Qué bien es, quién lo tiene a cargo, desde cuándo y dónde está.
        </p>
      </div>
      <BienesTable />
    </div>
  );
}
