import { PersonasTable, type PersonaFila } from "@/components/personas-table";
import { bienes, movimientos, personas } from "@/data/mock";
import { calcularEstado } from "@/lib/patrimonio";

const nombre = (id: string | null) =>
  id ? (personas.find((p) => p.id === id)?.nombre ?? null) : null;

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export default function PersonasPage() {
  const estados = bienes.map((b) => ({ bien: b, estado: calcularEstado(b, movimientos) }));

  const filas: PersonaFila[] = personas.map((p) => {
    const suyos = estados
      .filter((x) => x.estado.responsableId === p.id)
      .map(({ bien, estado }) => ({
        id: bien.id,
        codigoPatrimonial: bien.codigoPatrimonial,
        descripcion: bien.descripcion,
        ubicacion: estado.ubicacion,
        situacion: estado.situacion,
        aCargoDesde: estado.aCargoDesde ? dmy(estado.aCargoDesde) : null,
        custodiaDe: nombre(estado.custodiaDeId),
      }))
      .sort((a, b) => a.codigoPatrimonial.localeCompare(b.codigoPatrimonial));

    return {
      id: p.id,
      nombre: p.nombre,
      cargo: p.cargo,
      jefe: nombre(p.jefeId),
      activo: p.activo,
      // Propios primero, custodia después.
      bienes: [...suyos.filter((b) => !b.custodiaDe), ...suyos.filter((b) => b.custodiaDe)],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Personas</h1>
        <p className="text-sm text-muted-foreground">
          Quién trabaja en la entidad y cuántos bienes tiene a su cargo.
        </p>
      </div>
      <PersonasTable personas={filas} />
    </div>
  );
}
