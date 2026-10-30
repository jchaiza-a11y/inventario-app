import Link from "next/link";
import { Plus } from "lucide-react";
import { BienesTable } from "@/components/bienes-table";
import { Button } from "@/components/ui/button";

export default function BienesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bienes</h1>
          <p className="text-sm text-muted-foreground">
            Qué bien es, quién lo tiene a cargo, desde cuándo y dónde está.
          </p>
        </div>
        <Button className="h-10" render={<Link href="/bienes/nuevo" />} nativeButton={false}>
          <Plus className="size-4" />
          Nuevo bien
        </Button>
      </div>
      <BienesTable />
    </div>
  );
}
