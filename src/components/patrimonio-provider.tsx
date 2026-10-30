"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { bienes as bienesIniciales, catalogo, entidad, movimientos as movimientosIniciales, personas } from "@/data/mock";
import type { Bien, CatalogoItem, Movimiento, Persona } from "@/lib/patrimonio";

type Patrimonio = {
  entidad: string;
  catalogo: CatalogoItem[];
  personas: Persona[];
  bienes: Bien[];
  movimientos: Movimiento[];
  /** Solo agrega: un movimiento registrado no se edita ni se borra. */
  agregarMovimiento: (m: Movimiento) => void;
  /** Agrega bienes nuevos (solo en memoria, igual que los movimientos). */
  agregarBienes: (nuevos: Bien[]) => void;
};

const PatrimonioContext = createContext<Patrimonio | null>(null);

// Los bienes nuevos y los movimientos viven en memoria: se pierden al recargar la página.
export function PatrimonioProvider({ children }: { children: React.ReactNode }) {
  const [bienes, setBienes] = useState<Bien[]>(bienesIniciales);
  const [movimientos, setMovimientos] = useState<Movimiento[]>(movimientosIniciales);

  const agregarMovimiento = useCallback(
    (m: Movimiento) => setMovimientos((actuales) => [...actuales, m]),
    [],
  );

  const agregarBienes = useCallback(
    (nuevos: Bien[]) => setBienes((actuales) => [...actuales, ...nuevos]),
    [],
  );

  const valor = useMemo(
    () => ({ entidad, catalogo, personas, bienes, movimientos, agregarMovimiento, agregarBienes }),
    [bienes, movimientos, agregarMovimiento, agregarBienes],
  );

  return <PatrimonioContext.Provider value={valor}>{children}</PatrimonioContext.Provider>;
}

export function usePatrimonio() {
  const ctx = useContext(PatrimonioContext);
  if (!ctx) throw new Error("usePatrimonio debe usarse dentro de PatrimonioProvider");
  return ctx;
}
