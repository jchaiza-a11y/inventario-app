import { ActasTable } from "@/components/actas-table";
import { MovimientoForm } from "@/components/movimiento-form";

export default function MovimientosPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Registrar movimiento</h1>
          <p className="text-sm text-muted-foreground">
            Registra uno o varios bienes en una misma acta. Un movimiento registrado no se edita ni se borra.
          </p>
        </div>
        <MovimientoForm />
      </div>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-lg font-semibold">Actas registradas</h2>
        <ActasTable />
      </section>
    </div>
  );
}
