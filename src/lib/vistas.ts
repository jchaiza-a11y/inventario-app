import type { BienFicha } from "@/components/bien-detalle-sheet";
import type { BienFila } from "@/components/bienes-table";
import type { PersonaFila } from "@/components/personas-table";
import {
  calcularEstado,
  type EstadoConservacion,
  compararIds,
  type Bien,
  type Movimiento,
  type Persona,
} from "@/lib/patrimonio";

const nombreDe = (personas: Persona[], id: string | null) =>
  id ? (personas.find((p) => p.id === id)?.nombre ?? null) : null;

/** yyyy-mm-dd -> dd/mm/aaaa */
export const dmy = (iso: string) => iso.split("-").reverse().join("/");

export function filasBienes(
  bienes: Bien[],
  movimientos: Movimiento[],
  personas: Persona[],
): BienFila[] {
  const nombre = (id: string | null) => nombreDe(personas, id);

  return bienes.map((b) => {
    const e = calcularEstado(b, movimientos);
    const actual = {
      responsable: nombre(e.responsableId),
      ubicacion: e.ubicacion,
      situacion: e.situacion,
      aCargoDesde: e.aCargoDesde ? dmy(e.aCargoDesde) : null,
      custodiaDe: nombre(e.custodiaDeId),
    };
    const ficha: BienFicha = {
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
      actual,
      movimientos: movimientos
        .filter((m) => m.bienId === b.id)
        .sort((x, y) => y.fecha.localeCompare(x.fecha) || compararIds(y.id, x.id))
        .map((m) => ({
          id: m.id,
          fecha: dmy(m.fecha),
          tipo: m.tipo,
          de: nombre(m.responsableAnteriorId),
          a: nombre(m.responsableNuevoId),
          ubicacion: m.ubicacion,
          acta: m.acta,
        })),
    };

    return {
      id: b.id,
      codigoPatrimonial: b.codigoPatrimonial,
      descripcion: b.descripcion,
      detalle: `${b.marca} · ${b.modelo}`,
      responsable: actual.responsable,
      ubicacion: actual.ubicacion,
      situacion: actual.situacion,
      aCargoDesde: actual.aCargoDesde,
      custodiaDe: actual.custodiaDe,
      ficha,
    };
  });
}

export function filasPersonas(
  bienes: Bien[],
  movimientos: Movimiento[],
  personas: Persona[],
): PersonaFila[] {
  const nombre = (id: string | null) => nombreDe(personas, id);
  const estados = bienes.map((b) => ({ bien: b, estado: calcularEstado(b, movimientos) }));

  return personas.map((p) => {
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
}

export type FilaFicha = {
  item: number;
  codigoPatrimonial: string;
  denominacion: string;
  marca: string;
  modelo: string;
  serie: string;
  medida: string;
  color: string;
  estado: EstadoConservacion;
  aCargoDesde: string | null; // dd/mm/aaaa, null = S/F
  /** Nombre del trabajador original si el bien está en custodia. */
  custodiaDe: string | null;
};

/** Bienes que tiene hoy a su cargo una persona: propios primero, custodia después. */
export function filasFicha(
  personaId: string,
  bienes: Bien[],
  movimientos: Movimiento[],
  personas: Persona[],
): FilaFicha[] {
  const suyos = bienes
    .map((bien) => ({ bien, estado: calcularEstado(bien, movimientos) }))
    .filter((x) => x.estado.responsableId === personaId)
    .sort((a, b) => a.bien.codigoPatrimonial.localeCompare(b.bien.codigoPatrimonial));

  const ordenados = [
    ...suyos.filter((x) => !x.estado.custodiaDeId),
    ...suyos.filter((x) => x.estado.custodiaDeId),
  ];

  return ordenados.map(({ bien, estado }, i) => ({
    item: i + 1,
    codigoPatrimonial: bien.codigoPatrimonial,
    denominacion: bien.descripcion,
    marca: bien.marca,
    modelo: bien.modelo,
    serie: bien.serie,
    medida: bien.medidas,
    color: bien.color,
    estado: bien.estado,
    aCargoDesde: estado.aCargoDesde ? dmy(estado.aCargoDesde) : null,
    custodiaDe: nombreDe(personas, estado.custodiaDeId),
  }));
}
