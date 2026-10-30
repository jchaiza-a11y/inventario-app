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

export type EntradaMovimiento = {
  tipo: TipoMovimiento | "";
  bien: Bien | null;
  /** Solo para ASIGNACION. */
  nuevoResponsableId: string;
  /** Destino (ASIGNACION, SALIDA) o ubicación donde queda (REINGRESO). */
  ubicacion: string;
  /** dd/mm/aaaa */
  fecha: string;
  acta: string;
  motivo: string;
};

export type Errores = Partial<Record<"tipo" | "bien" | "responsable" | "ubicacion" | "fecha" | "acta" | "general", string>>;

export type Resultado =
  | { ok: true; movimiento: Movimiento }
  | { ok: false; errores: Errores };

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

/** Problemas del bien frente al tipo elegido (no dependen de los demás campos). */
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

export function prepararMovimiento(
  e: EntradaMovimiento,
  personas: Persona[],
  movimientos: Movimiento[],
): Resultado {
  const errores: Errores = {};

  if (!e.tipo) errores.tipo = "Elige el tipo de movimiento.";
  if (!e.bien) errores.bien = "Elige el bien.";

  const estado = e.bien ? calcularEstado(e.bien, movimientos) : null;
  if (e.tipo && estado) {
    const err = errorDeTipo(e.tipo, estado, personas);
    if (err) errores.general = err;
  }

  // Responsable nuevo según el tipo.
  let responsableNuevoId: string | null = null;
  if (e.tipo && estado) {
    if (e.tipo === "ASIGNACION") {
      if (!e.nuevoResponsableId) errores.responsable = "Elige el nuevo responsable.";
      else if (e.nuevoResponsableId === estado.responsableId)
        errores.responsable = "Esa persona ya tiene el bien a su cargo.";
      else if (!personas.find((p) => p.id === e.nuevoResponsableId)?.activo)
        errores.responsable = "Solo se puede asignar a una persona ACTIVA.";
      responsableNuevoId = e.nuevoResponsableId || null;
    } else if (e.tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO") {
      responsableNuevoId = jefeDe(personas, estado.responsableId)?.id ?? null;
    } else {
      responsableNuevoId = estado.responsableId; // el responsable no cambia
    }
  }

  const ubicacion = e.ubicacion.trim();
  if (e.tipo && e.tipo !== "PASE A CUSTODIA DEL JEFE INMEDIATO" && !ubicacion) {
    errores.ubicacion =
      e.tipo === "REINGRESO DE REPARACION"
        ? "Indica la ubicación donde queda el bien."
        : "Indica la ubicación de destino.";
  }

  const fechaIso = fechaAIso(e.fecha);
  if (!fechaIso) {
    errores.fecha = "Escribe una fecha válida con el formato dd/mm/aaaa.";
  } else if (e.bien) {
    const ultima = movimientos
      .filter((m) => m.bienId === e.bien!.id)
      .map((m) => m.fecha)
      .sort()
      .at(-1);
    if (ultima && fechaIso < ultima) {
      errores.fecha = `La fecha no puede ser anterior al último movimiento del bien (${ultima.split("-").reverse().join("/")}).`;
    }
  }

  if (!e.acta.trim()) errores.acta = "Escribe el N° de acta.";

  if (Object.keys(errores).length > 0 || !e.tipo || !e.bien || !estado || !fechaIso) {
    return { ok: false, errores };
  }

  const siguiente = movimientos.reduce((max, m) => (compararIds(m.id, max) > 0 ? m.id : max), "m00");
  const n = Number(siguiente.replace(/\D/g, "")) + 1;

  return {
    ok: true,
    movimiento: {
      id: `m${String(n).padStart(2, "0")}`,
      fecha: fechaIso,
      tipo: e.tipo,
      bienId: e.bien.id,
      responsableAnteriorId: estado.responsableId,
      responsableNuevoId,
      // La custodia no pide ubicación: el bien se queda donde está.
      ubicacion: e.tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO" ? estado.ubicacion : ubicacion,
      acta: e.acta.trim(),
      ...(e.motivo.trim() ? { motivo: e.motivo.trim() } : {}),
    },
  };
}
