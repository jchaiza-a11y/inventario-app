import type { Bien, CatalogoItem, EstadoConservacion, Persona } from "@/lib/patrimonio";

export const MAX_CANTIDAD = 20;
const MAX_CORRELATIVO = 9999;

/** Texto que se muestra cuando falta un dato (el dato se guarda vacío = sin dato). */
const sinDato = (valor: string, texto: string) => (valor.trim() ? valor.trim() : texto);

/**
 * Datos del bien tal como se muestran y se imprimen:
 * marca, modelo y medidas vacíos → "S/M"; serie vacía → "S/S"; color vacío → en blanco.
 */
export function datosVisibles(bien: Bien) {
  return {
    marca: sinDato(bien.marca, "S/M"),
    modelo: sinDato(bien.modelo, "S/M"),
    serie: sinDato(bien.serie, "S/S"),
    medidas: sinDato(bien.medidas, "S/M"),
    color: bien.color.trim(),
  };
}

/**
 * Códigos patrimoniales (12 dígitos) que se generarían para `cantidad` bienes nuevos de un tipo:
 * el código de catálogo (8) más el correlativo (4), que parte del mayor que existe EN ESE TIPO más uno.
 * Devuelve null si no alcanzan los correlativos (el máximo es 9999 por tipo).
 */
export function codigosNuevos(bienes: Bien[], codigoCatalogo: string, cantidad: number): string[] | null {
  const mayor = bienes
    .filter((b) => b.codigoPatrimonial.startsWith(codigoCatalogo))
    .reduce((m, b) => Math.max(m, Number(b.codigoPatrimonial.slice(8))), 0);
  if (mayor + cantidad > MAX_CORRELATIVO) return null;
  return Array.from({ length: cantidad }, (_, i) => codigoCatalogo + String(mayor + i + 1).padStart(4, "0"));
}

export type EntradaBien = {
  tipo: CatalogoItem | null;
  marca: string;
  modelo: string;
  serie: string;
  medidas: string;
  color: string;
  estado: EstadoConservacion | "";
  /** Id de la persona; "" = sin responsable. */
  responsableId: string;
  ubicacion: string;
  cantidad: string;
};

export type ErroresBien = Partial<Record<"tipo" | "estado" | "responsable" | "cantidad", string>>;

export type ResultadoBienes = { ok: true; bienes: Bien[] } | { ok: false; errores: ErroresBien };

/** Cantidad válida (entero de 1 a 20) o null. */
export function cantidadValida(texto: string): number | null {
  const n = Number(texto);
  return texto.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= MAX_CANTIDAD ? n : null;
}

/** Valida el formulario y arma los bienes nuevos, con correlativos consecutivos dentro de su tipo. */
export function prepararBienes(e: EntradaBien, existentes: Bien[], personas: Persona[]): ResultadoBienes {
  const errores: ErroresBien = {};
  const cantidad = cantidadValida(e.cantidad);

  if (!e.tipo) errores.tipo = "Elige el tipo de bien.";
  if (!e.estado) errores.estado = "Elige el estado de conservación.";
  if (cantidad === null) errores.cantidad = `La cantidad debe ser un número entero de 1 a ${MAX_CANTIDAD}.`;
  if (e.responsableId) {
    const persona = personas.find((p) => p.id === e.responsableId);
    if (!persona?.activo) errores.responsable = "Solo se puede elegir a una persona ACTIVA.";
  }

  let codigos: string[] | null = null;
  if (e.tipo && cantidad !== null) {
    codigos = codigosNuevos(existentes, e.tipo.codigo, cantidad);
    if (!codigos) errores.cantidad = `No alcanzan los correlativos de este tipo de bien (el máximo es ${MAX_CORRELATIVO}).`;
  }

  if (Object.keys(errores).length > 0 || !e.tipo || !e.estado || !codigos) return { ok: false, errores };

  const ultimoId = existentes.reduce((m, b) => Math.max(m, Number(/^b(\d+)$/.exec(b.id)?.[1] ?? 0)), 0);
  const tipo = e.tipo;
  const estado = e.estado;
  return {
    ok: true,
    bienes: codigos.map((codigo, i) => ({
      id: `b${ultimoId + i + 1}`,
      codigoPatrimonial: codigo,
      descripcion: tipo.denominacion,
      marca: e.marca.trim(),
      modelo: e.modelo.trim(),
      serie: e.serie.trim(),
      medidas: e.medidas.trim(),
      color: e.color.trim(),
      estado,
      responsableInicialId: e.responsableId || null,
      ubicacionInicial: e.ubicacion.trim(),
    })),
  };
}
