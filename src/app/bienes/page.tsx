import { BienesTable, type BienFila } from "@/components/bienes-table";
import { bienes, movimientos, personas } from "@/data/mock";
import { calcularEstado } from "@/lib/patrimonio";

const nombre = (id: string | null) =>
  id ? (personas.find((p) => p.id === id)?.nombre ?? null) : null;

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export default function BienesPage() {
  const filas: BienFila[] = bienes.map((b) => {
    const e = calcularEstado(b, movimientos);
    return {
      id: b.id,
      codigoPatrimonial: b.codigoPatrimonial,
      descripcion: b.descripcion,
      detalle: `${b.marca} · ${b.modelo}`,
      responsable: nombre(e.responsableId),
      ubicacion: e.ubicacion,
      situacion: e.situacion,
      aCargoDesde: e.aCargoDesde ? dmy(e.aCargoDesde) : null,
      custodiaDe: nombre(e.custodiaDeId),
      ficha: {
        datos: {
          codigoPatrimonial: b.codigoPatrimonial,
          descripcion: b.descripcion,
          marca: b.marca,
          modelo: b.modelo,
          serie: b.serie,
          medidas: b.medidas,
          color: b.color,
          estado: b.estado,
        },
        actual: {
          responsable: nombre(e.responsableId),
          ubicacion: e.ubicacion,
          situacion: e.situacion,
          aCargoDesde: e.aCargoDesde ? dmy(e.aCargoDesde) : null,
          custodiaDe: nombre(e.custodiaDeId),
        },
        movimientos: movimientos
          .filter((m) => m.bienId === b.id)
          .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.id.localeCompare(x.id))
          .map((m) => ({
            id: m.id,
            fecha: dmy(m.fecha),
            tipo: m.tipo,
            de: nombre(m.responsableAnteriorId),
            a: nombre(m.responsableNuevoId),
            ubicacion: m.ubicacion,
            acta: m.acta,
          })),
      },
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bienes</h1>
        <p className="text-sm text-muted-foreground">
          Qué bien es, quién lo tiene a cargo, desde cuándo y dónde está.
        </p>
      </div>
      <BienesTable filas={filas} />
    </div>
  );
}
