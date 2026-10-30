import { MovimientoForm } from "@/components/movimiento-form";

export default function MovimientosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Registrar movimiento</h1>
        <p className="text-sm text-muted-foreground">
          Registra un movimiento para un bien. Un movimiento registrado no se edita ni se borra.
        </p>
      </div>
      <MovimientoForm />
    </div>
  );
}
