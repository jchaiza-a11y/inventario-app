export type EstadoConservacion = "N" | "B" | "R" | "M";

export type TipoMovimiento =
  | "ASIGNACION"
  | "SALIDA A REPARACION"
  | "REINGRESO DE REPARACION"
  | "PASE A CUSTODIA DEL JEFE INMEDIATO";

export type Situacion = "EN USO" | "EN REPARACION" | "SIN ASIGNAR";

export type Persona = {
  id: string;
  nombre: string;
  cargo: string;
  jefeId: string | null;
  activo: boolean;
};

export type Bien = {
  id: string;
  /** 12 dígitos: 8 del catálogo + 4 de correlativo. Siempre texto. */
  codigoPatrimonial: string;
  descripcion: string;
  marca: string;
  modelo: string;
  serie: string;
  medidas: string;
  color: string;
  estado: EstadoConservacion;
  /** Responsable migrado del sistema anterior (sin fecha). */
  responsableInicialId: string | null;
  ubicacionInicial: string;
};

export type Movimiento = {
  id: string;
  /** ISO yyyy-mm-dd */
  fecha: string;
  tipo: TipoMovimiento;
  bienId: string;
  responsableAnteriorId: string | null;
  responsableNuevoId: string | null;
  ubicacion: string;
  acta: string;
  motivo?: string;
};

export type EstadoCalculado = {
  responsableId: string | null;
  ubicacion: string;
  situacion: Situacion;
  /** null = bien migrado sin fecha ("S/F") */
  aCargoDesde: string | null;
  /** Si hay custodia, id de la persona de quien eran los bienes. */
  custodiaDeId: string | null;
};

/** Compara ids tipo "m09" < "m10" < "m100" por su parte numérica. */
export const compararIds = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true });

/**
 * Calcula el estado actual de un bien a partir de sus movimientos.
 * Rige el último movimiento; sin movimientos rige el responsable inicial.
 * - "A su cargo desde": fecha del último movimiento en que el responsable
 *   recibió el bien (asignación o pase a custodia); reparación no la cambia.
 * - Custodia: la fija el pase a custodia (a nombre del trabajador original),
 *   se conserva en nuevos pases y en reparaciones, y desaparece con una
 *   asignación.
 */
export function calcularEstado(
  bien: Bien,
  movimientos: Movimiento[],
): EstadoCalculado {
  const propios = movimientos
    .filter((m) => m.bienId === bien.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || compararIds(a.id, b.id));

  let responsableId = bien.responsableInicialId;
  let ubicacion = bien.ubicacionInicial;
  let aCargoDesde: string | null = null;
  let custodiaDeId: string | null = null;
  let enReparacion = false;

  for (const m of propios) {
    responsableId = m.responsableNuevoId;
    ubicacion = m.ubicacion;

    switch (m.tipo) {
      case "ASIGNACION":
        aCargoDesde = m.fecha;
        custodiaDeId = null;
        enReparacion = false;
        break;
      case "PASE A CUSTODIA DEL JEFE INMEDIATO":
        aCargoDesde = m.fecha;
        // Si ya estaba en custodia se conserva al trabajador original.
        custodiaDeId = custodiaDeId ?? m.responsableAnteriorId;
        enReparacion = false;
        break;
      case "SALIDA A REPARACION":
        enReparacion = true;
        break;
      case "REINGRESO DE REPARACION":
        enReparacion = false;
        break;
    }
  }

  const situacion: Situacion = enReparacion
    ? "EN REPARACION"
    : responsableId
      ? "EN USO"
      : "SIN ASIGNAR";

  return { responsableId, ubicacion, situacion, aCargoDesde, custodiaDeId };
}
