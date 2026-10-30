import {
  calcularEstado,
  compararIds,
  type Bien,
  type EstadoCalculado,
  type Movimiento,
  type Persona,
  type TipoMovimiento,
} from "@/lib/patrimonio";

export const TIPOS: TipoMovimiento[] = [
  "ASIGNACION",
  "SALIDA A REPARACION",
  "REINGRESO DE REPARACION",
  "PASE A CUSTODIA DEL JEFE INMEDIATO",
];

/** Datos comunes de la acta más la lista de bienes que la componen. */
export type EntradaActa = {
  tipo: TipoMovimiento | "";
  bienes: Bien[];
  /** Solo para ASIGNACION. */
  nuevoResponsableId: string;
  /** Destino (ASIGNACION, SALIDA) o ubicación donde quedan (REINGRESO). */
  ubicacion: string;
  /** dd/mm/aaaa */
  fecha: string;
  acta: string;
  motivo: string;
};

export type Errores = Partial<
  Record<"tipo" | "bienes" | "responsable" | "ubicacion" | "fecha" | "acta", string>
>;

export type ResultadoActa =
  | { ok: true; movimientos: Movimiento[] }
  | { ok: false; errores: Errores; porBien: Record<string, string> };

export const claveActa = (acta: string) => acta.trim().toUpperCase();
const dmy = (iso: string) => iso.split("-").reverse().join("/");

/** dd/mm/aaaa -> yyyy-mm-dd, o null si no es una fecha real. */
export function fechaAIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function hoyDmy(): string {
  const h = new Date();
  const dd = String(h.getDate()).padStart(2, "0");
  const mm = String(h.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${h.getFullYear()}`;
}

/** Jefe inmediato de quien tiene hoy el bien (null si no hay responsable o jefe). */
export function jefeDe(personas: Persona[], responsableId: string | null): Persona | null {
  const jefeId = personas.find((p) => p.id === responsableId)?.jefeId;
  return jefeId ? (personas.find((p) => p.id === jefeId) ?? null) : null;
}

/** Problemas del bien frente al tipo elegido (no dependen de fecha ni acta). */
export function errorDeTipo(
  tipo: TipoMovimiento | "",
  estado: EstadoCalculado,
  personas: Persona[],
): string | null {
  if (!tipo) return null;

  if (estado.situacion === "SIN ASIGNAR" && tipo !== "ASIGNACION") {
    return "Un bien SIN ASIGNAR solo admite una ASIGNACION.";
  }
  if (tipo === "SALIDA A REPARACION" && estado.situacion !== "EN USO") {
    return "Solo puede salir a reparación un bien que esté EN USO.";
  }
  if (tipo === "REINGRESO DE REPARACION" && estado.situacion !== "EN REPARACION") {
    return "Solo puede reingresar de reparación un bien que esté EN REPARACION.";
  }
  if (
    (tipo === "ASIGNACION" || tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO") &&
    estado.situacion === "EN REPARACION"
  ) {
    return "El bien está EN REPARACION: primero debe registrarse su reingreso.";
  }
  if (tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO" && estado.situacion === "EN USO") {
    const resp = personas.find((p) => p.id === estado.responsableId);
    if (!jefeDe(personas, estado.responsableId)) {
      return `${resp?.nombre ?? "El responsable actual"} no tiene jefe inmediato registrado: no se puede pasar el bien a custodia.`;
    }
  }
  return null;
}

/** Error de un bien según tipo y (en asignaciones) nuevo responsable. */
export function errorDeBien(
  tipo: TipoMovimiento | "",
  estado: EstadoCalculado,
  nuevoResponsableId: string,
  personas: Persona[],
): string | null {
  const err = errorDeTipo(tipo, estado, personas);
  if (err) return err;
  if (tipo === "ASIGNACION" && nuevoResponsableId && nuevoResponsableId === estado.responsableId) {
    return "Esa persona ya tiene el bien a su cargo.";
  }
  return null;
}

/**
 * Valida la acta completa (todo o nada) y arma un movimiento por cada bien.
 * Una acta existente solo admite más bienes si tiene el mismo tipo y fecha.
 */
export function prepararActa(
  e: EntradaActa,
  personas: Persona[],
  movimientos: Movimiento[],
): ResultadoActa {
  const errores: Errores = {};
  const porBien: Record<string, string> = {};

  if (!e.tipo) errores.tipo = "Elige el tipo de movimiento.";
  if (e.bienes.length === 0) errores.bienes = "Agrega al menos un bien a la acta.";

  if (e.tipo === "ASIGNACION") {
    if (!e.nuevoResponsableId) errores.responsable = "Elige el nuevo responsable.";
    else if (!personas.find((p) => p.id === e.nuevoResponsableId)?.activo)
      errores.responsable = "Solo se puede asignar a una persona ACTIVA.";
  }

  const ubicacion = e.ubicacion.trim();
  if (e.tipo && e.tipo !== "PASE A CUSTODIA DEL JEFE INMEDIATO" && !ubicacion) {
    errores.ubicacion =
      e.tipo === "REINGRESO DE REPARACION"
        ? "Indica la ubicación donde quedan los bienes."
        : "Indica la ubicación de destino.";
  }

  const fechaIso = fechaAIso(e.fecha);
  if (!fechaIso) errores.fecha = "Escribe una fecha válida con el formato dd/mm/aaaa.";

  const acta = e.acta.trim();
  const clave = claveActa(acta);
  const deLaActa = clave ? movimientos.filter((m) => claveActa(m.acta) === clave) : [];
  if (!acta) {
    errores.acta = "Escribe el N° de acta.";
  } else if (e.tipo && fechaIso) {
    const distinta = deLaActa.find((m) => m.tipo !== e.tipo || m.fecha !== fechaIso);
    if (distinta) {
      errores.acta = `El N° de acta ${acta} ya existe con ${distinta.tipo} del ${dmy(distinta.fecha)}. Una acta solo admite más bienes del mismo tipo y fecha: usa otro número o corrige el tipo y la fecha.`;
    }
  }

  // Validación de cada bien con las mismas reglas de siempre.
  for (const bien of e.bienes) {
    const estado = calcularEstado(bien, movimientos);
    let err = errorDeBien(e.tipo, estado, e.nuevoResponsableId, personas);
    if (!err && deLaActa.some((m) => m.bienId === bien.id)) {
      err = `Este bien ya está registrado en el ${acta}.`;
    }
    if (!err && fechaIso) {
      const ultima = movimientos
        .filter((m) => m.bienId === bien.id)
        .map((m) => m.fecha)
        .sort()
        .at(-1);
      if (ultima && fechaIso < ultima) {
        err = `La fecha no puede ser anterior al último movimiento del bien (${dmy(ultima)}).`;
      }
    }
    if (err) porBien[bien.id] = err;
  }

  if (Object.keys(errores).length > 0 || Object.keys(porBien).length > 0 || !e.tipo || !fechaIso) {
    return { ok: false, errores, porBien };
  }

  const ultimoId = movimientos.reduce((max, m) => (compararIds(m.id, max) > 0 ? m.id : max), "m00");
  const base = Number(ultimoId.replace(/\D/g, ""));
  const tipo = e.tipo;

  return {
    ok: true,
    movimientos: e.bienes.map((bien, i) => {
      const estado = calcularEstado(bien, movimientos);
      const responsableNuevoId =
        tipo === "ASIGNACION"
          ? e.nuevoResponsableId
          : tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO"
            ? (jefeDe(personas, estado.responsableId)?.id ?? null) // se calcula bien por bien
            : estado.responsableId; // reparación: el responsable no cambia
      return {
        id: `m${String(base + i + 1).padStart(2, "0")}`,
        fecha: fechaIso,
        tipo,
        bienId: bien.id,
        responsableAnteriorId: estado.responsableId,
        responsableNuevoId,
        // La custodia no pide ubicación: cada bien se queda donde está.
        ubicacion: tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO" ? estado.ubicacion : ubicacion,
        // Si la acta ya existe se conserva su grafía registrada.
        acta: deLaActa[0]?.acta ?? acta,
        ...(e.motivo.trim() ? { motivo: e.motivo.trim() } : {}),
      };
    }),
  };
}

export type ActaResumen = {
  clave: string;
  acta: string;
  tipo: TipoMovimiento;
  fecha: string; // yyyy-mm-dd
  cantidad: number;
};

/** Agrupa los movimientos por N° de acta (las más recientes primero). */
export function resumenActas(movimientos: Movimiento[]): ActaResumen[] {
  const grupos = new Map<string, ActaResumen>();
  for (const m of movimientos) {
    const clave = claveActa(m.acta);
    const g = grupos.get(clave);
    if (g) g.cantidad += 1;
    else grupos.set(clave, { clave, acta: m.acta, tipo: m.tipo, fecha: m.fecha, cantidad: 1 });
  }
  return [...grupos.values()].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.acta.localeCompare(a.acta),
  );
}
