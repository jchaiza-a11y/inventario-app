import { PersonasTable } from "@/components/personas-table";

export default function PersonasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Personas</h1>
        <p className="text-sm text-muted-foreground">
          Quién trabaja en la entidad y cuántos bienes tiene a su cargo.
        </p>
      </div>
      <PersonasTable />
    </div>
  );
}
