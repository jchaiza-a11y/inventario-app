import type { BienFicha } from "@/components/bien-detalle-sheet";
import type { BienFila } from "@/components/bienes-table";
import type { PersonaFila } from "@/components/personas-table";
import { datosVisibles } from "@/lib/bienes";
import { claveActa } from "@/lib/movimientos";
import {
  calcularEstado,
  type TipoMovimiento,
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
        ...datosVisibles(b),
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
      detalle: `${datosVisibles(b).marca} · ${datosVisibles(b).modelo}`,
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
    marca: datosVisibles(bien).marca,
    modelo: datosVisibles(bien).modelo,
    serie: datosVisibles(bien).serie,
    medida: datosVisibles(bien).medidas,
    color: datosVisibles(bien).color,
    estado: bien.estado,
    aCargoDesde: estado.aCargoDesde ? dmy(estado.aCargoDesde) : null,
    custodiaDe: nombreDe(personas, estado.custodiaDeId),
  }));
}

const TITULOS_ACTA: Record<TipoMovimiento, string> = {
  ASIGNACION: "ACTA DE ENTREGA / ASIGNACIÓN DE BIENES",
  "SALIDA A REPARACION": "PAPELETA DE SALIDA DE BIENES PARA REPARACIÓN",
  "REINGRESO DE REPARACION": "ACTA DE REINGRESO DE BIENES REPARADOS",
  "PASE A CUSTODIA DEL JEFE INMEDIATO": "ACTA DE CUSTODIA TEMPORAL DE BIENES",
};

export type FilaActa = {
  item: number;
  codigoPatrimonial: string;
  denominacion: string;
  marca: string;
  modelo: string;
  serie: string;
  medida: string;
  color: string;
  estado: EstadoConservacion;
  /** Nombre del trabajador original (solo en el pase a custodia). */
  custodiaDe: string | null;
};

export type DatosActa = {
  acta: string;
  titulo: string;
  tipo: TipoMovimiento;
  fecha: string; // dd/mm/aaaa
  ubicacion: string;
  motivo: string | null;
  entrega: string;
  recibe: string;
  filas: FilaActa[];
};

const unicos = (xs: string[]) => Array.from(new Set(xs));
const unir = (xs: string[]) => unicos(xs).join(", ");

/** Datos del acta de un N° de acta (null si no existe), con entrega y recepción por tipo. */
export function datosActa(
  numero: string,
  bienes: Bien[],
  movimientos: Movimiento[],
  personas: Persona[],
): DatosActa | null {
  const clave = claveActa(numero);
  const deLaActa = movimientos
    .filter((m) => claveActa(m.acta) === clave)
    .sort((a, b) => compararIds(a.id, b.id));
  if (deLaActa.length === 0) return null;

  const { tipo, fecha, acta } = deLaActa[0];
  const nombre = (id: string | null) => nombreDe(personas, id);

  // Estado del bien justo antes / justo después de este movimiento.
  const hasta = (m: Movimiento, incluir: boolean) =>
    movimientos.filter(
      (x) =>
        x.bienId === m.bienId &&
        (x.fecha < m.fecha ||
          (x.fecha === m.fecha && (incluir ? compararIds(x.id, m.id) <= 0 : compararIds(x.id, m.id) < 0))),
    );
  const bienDe = (m: Movimiento) => bienes.find((b) => b.id === m.bienId)!;

  const anteriores = deLaActa.map((m) => nombre(m.responsableAnteriorId) ?? "Control Patrimonial");
  const nuevos = deLaActa.map((m) => nombre(m.responsableNuevoId) ?? "Control Patrimonial");
  const destinos = deLaActa.map((m) => m.ubicacion);
  const procedencias = deLaActa.map((m) => calcularEstado(bienDe(m), hasta(m, false)).ubicacion);

  let entrega: string;
  let recibe: string;
  switch (tipo) {
    case "ASIGNACION": // un bien SIN ASIGNAR lo entrega Control Patrimonial
      entrega = unir(anteriores);
      recibe = unir(nuevos);
      break;
    case "SALIDA A REPARACION":
      entrega = unir(anteriores);
      recibe = unir(destinos);
      break;
    case "REINGRESO DE REPARACION":
      entrega = unir(procedencias);
      recibe = unir(nuevos);
      break;
    case "PASE A CUSTODIA DEL JEFE INMEDIATO":
      entrega = unir(anteriores);
      recibe = unir(nuevos);
      break;
  }

  const motivos = unicos(deLaActa.map((m) => m.motivo ?? "").filter(Boolean));

  return {
    acta,
    titulo: TITULOS_ACTA[tipo],
    tipo,
    fecha: dmy(fecha),
    ubicacion: unir(destinos),
    motivo: motivos.length ? motivos.join("; ") : null,
    entrega,
    recibe,
    filas: deLaActa.map((m, i) => {
      const bien = bienDe(m);
      const custodiaDeId =
        tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO"
          ? calcularEstado(bien, hasta(m, true)).custodiaDeId
          : null;
      return {
        item: i + 1,
        codigoPatrimonial: bien.codigoPatrimonial,
        denominacion: bien.descripcion,
        marca: datosVisibles(bien).marca,
        modelo: datosVisibles(bien).modelo,
        serie: datosVisibles(bien).serie,
        medida: datosVisibles(bien).medidas,
        color: datosVisibles(bien).color,
        estado: bien.estado,
        custodiaDe: nombre(custodiaDeId),
      };
    }),
  };
}
