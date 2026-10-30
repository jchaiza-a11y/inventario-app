import type { Bien, Movimiento, Persona } from "@/lib/patrimonio";

export const entidad = "Entidad de ejemplo";

// Datos ficticios. Jerarquía: Director -> Encargado de Abastecimiento -> Técnico / Auxiliar.
export const personas: Persona[] = [
  { id: "p1", nombre: "Carlos Mendoza Rivas", cargo: "Director", oficina: "Dirección General", jefeId: null, activo: true },
  { id: "p2", nombre: "Rosa Quispe Huamán", cargo: "Encargada de Abastecimiento", oficina: "Oficina de Abastecimiento", jefeId: "p1", activo: true },
  { id: "p3", nombre: "Luis Paredes Soto", cargo: "Técnico", oficina: "Oficina de Abastecimiento", jefeId: "p2", activo: false }, // CESADO (renunció 30/09/2025)
  { id: "p4", nombre: "Ana Torres Vega", cargo: "Auxiliar", oficina: "Oficina de Abastecimiento", jefeId: "p2", activo: true },
];

const OF_ABAST = "Oficina de Abastecimiento";
const ALMACEN = "Almacén central";
const DIRECCION = "Dirección General";
const TALLER = "Servicio técnico externo";

export const bienes: Bien[] = [
  { id: "b1", codigoPatrimonial: "746452230001", descripcion: "Computadora portátil", marca: "Lenovo", modelo: "ThinkPad E14", serie: "PF3K91AA", medidas: "32.4 × 22.8 × 1.9 cm", color: "Negro", estado: "B", responsableInicialId: "p3", ubicacionInicial: OF_ABAST },
  { id: "b2", codigoPatrimonial: "746452260002", descripcion: "Monitor LED 24 pulgadas", marca: "Samsung", modelo: "S24R350", serie: "ZZ4PH1KT", medidas: "54.0 × 41.0 × 18.0 cm", color: "Negro", estado: "B", responsableInicialId: null, ubicacionInicial: ALMACEN },
  { id: "b3", codigoPatrimonial: "746452240003", descripcion: "Impresora láser multifuncional", marca: "HP", modelo: "LaserJet M428", serie: "VNB3K20117", medidas: "40.5 × 36.0 × 31.0 cm", color: "Blanco", estado: "R", responsableInicialId: "p3", ubicacionInicial: OF_ABAST },
  { id: "b4", codigoPatrimonial: "536096500004", descripcion: "Silla giratoria de oficina", marca: "Forli", modelo: "Ejecutiva 220", serie: "S/S", medidas: "60 × 60 × 95 cm", color: "Negro", estado: "R", responsableInicialId: "p2", ubicacionInicial: OF_ABAST },
  { id: "b5", codigoPatrimonial: "536042100005", descripcion: "Escritorio de madera", marca: "Muebles Lima", modelo: "ML-180", serie: "S/S", medidas: "150 × 70 × 75 cm", color: "Caoba", estado: "B", responsableInicialId: "p1", ubicacionInicial: DIRECCION },
  { id: "b6", codigoPatrimonial: "746452230006", descripcion: "Computadora portátil", marca: "Dell", modelo: "Latitude 3420", serie: "7HX2N34", medidas: "32.1 × 21.5 × 1.8 cm", color: "Gris", estado: "N", responsableInicialId: null, ubicacionInicial: ALMACEN },
  { id: "b7", codigoPatrimonial: "746415500007", descripcion: "Proyector multimedia", marca: "Epson", modelo: "PowerLite X49", serie: "X8JK7701234", medidas: "30.2 × 23.5 × 8.4 cm", color: "Blanco", estado: "B", responsableInicialId: "p2", ubicacionInicial: OF_ABAST },
  { id: "b8", codigoPatrimonial: "746452200008", descripcion: "Computadora de escritorio", marca: "HP", modelo: "ProDesk 400 G7", serie: "MXL1230PQ8", medidas: "29.5 × 28.0 × 9.5 cm", color: "Negro", estado: "N", responsableInicialId: null, ubicacionInicial: ALMACEN },
  { id: "b9", codigoPatrimonial: "536096500009", descripcion: "Silla giratoria de oficina", marca: "Forli", modelo: "Operativa 110", serie: "S/S", medidas: "58 × 58 × 90 cm", color: "Azul", estado: "N", responsableInicialId: null, ubicacionInicial: ALMACEN },
  { id: "b10", codigoPatrimonial: "536011800010", descripcion: "Archivador metálico de 4 cajones", marca: "Metalmecánica Sur", modelo: "AM-4C", serie: "S/S", medidas: "47 × 62 × 132 cm", color: "Gris", estado: "R", responsableInicialId: "p3", ubicacionInicial: OF_ABAST },
];

export const movimientos: Movimiento[] = [
  // Monitor: asignado al Técnico y luego pasa en custodia al jefe por la renuncia.
  { id: "m01", fecha: "2024-03-12", tipo: "ASIGNACION", bienId: "b2", responsableAnteriorId: null, responsableNuevoId: "p3", ubicacion: OF_ABAST, acta: "ACTA-0012-2024" },
  // Renuncia del Técnico (30/09/2025): sus 4 bienes pasan en custodia a su jefe.
  { id: "m02", fecha: "2025-10-01", tipo: "PASE A CUSTODIA DEL JEFE INMEDIATO", bienId: "b1", responsableAnteriorId: "p3", responsableNuevoId: "p2", ubicacion: OF_ABAST, acta: "ACTA-0045-2025" },
  { id: "m03", fecha: "2025-10-01", tipo: "PASE A CUSTODIA DEL JEFE INMEDIATO", bienId: "b2", responsableAnteriorId: "p3", responsableNuevoId: "p2", ubicacion: OF_ABAST, acta: "ACTA-0045-2025" },
  { id: "m04", fecha: "2025-10-01", tipo: "PASE A CUSTODIA DEL JEFE INMEDIATO", bienId: "b3", responsableAnteriorId: "p3", responsableNuevoId: "p2", ubicacion: OF_ABAST, acta: "ACTA-0045-2025" },
  { id: "m05", fecha: "2025-10-01", tipo: "PASE A CUSTODIA DEL JEFE INMEDIATO", bienId: "b10", responsableAnteriorId: "p3", responsableNuevoId: "p2", ubicacion: OF_ABAST, acta: "ACTA-0045-2025" },
  // Ingresa un Auxiliar nuevo: recibe bienes nuevos y el archivador (la custodia desaparece).
  { id: "m06", fecha: "2025-10-15", tipo: "ASIGNACION", bienId: "b8", responsableAnteriorId: null, responsableNuevoId: "p4", ubicacion: OF_ABAST, acta: "ACTA-0051-2025" },
  { id: "m07", fecha: "2025-10-15", tipo: "ASIGNACION", bienId: "b9", responsableAnteriorId: null, responsableNuevoId: "p4", ubicacion: OF_ABAST, acta: "ACTA-0051-2025" },
  { id: "m08", fecha: "2025-10-20", tipo: "ASIGNACION", bienId: "b10", responsableAnteriorId: "p2", responsableNuevoId: "p4", ubicacion: OF_ABAST, acta: "ACTA-0053-2025" },
  // Impresora (en custodia): sale a reparación y reingresa; la custodia se conserva.
  { id: "m09", fecha: "2025-11-05", tipo: "SALIDA A REPARACION", bienId: "b3", responsableAnteriorId: "p2", responsableNuevoId: "p2", ubicacion: TALLER, acta: "ACTA-0060-2025" },
  { id: "m10", fecha: "2025-11-26", tipo: "REINGRESO DE REPARACION", bienId: "b3", responsableAnteriorId: "p2", responsableNuevoId: "p2", ubicacion: OF_ABAST, acta: "ACTA-0067-2025" },
  // Proyector: sigue en reparación.
  { id: "m11", fecha: "2026-02-10", tipo: "SALIDA A REPARACION", bienId: "b7", responsableAnteriorId: "p2", responsableNuevoId: "p2", ubicacion: TALLER, acta: "ACTA-0008-2026" },
];
