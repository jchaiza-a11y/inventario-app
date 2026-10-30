import { ResumenPanel } from "@/components/resumen-panel";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resumen</h1>
        <p className="text-sm text-muted-foreground">
          Estado general de los bienes, alertas y últimos movimientos.
        </p>
      </div>
      <ResumenPanel />
    </div>
  );
}
