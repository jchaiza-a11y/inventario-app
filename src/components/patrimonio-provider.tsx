"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { bienes, movimientos as movimientosIniciales, personas } from "@/data/mock";
import type { Bien, Movimiento, Persona } from "@/lib/patrimonio";

type Patrimonio = {
  personas: Persona[];
  bienes: Bien[];
  movimientos: Movimiento[];
  /** Solo agrega: un movimiento registrado no se edita ni se borra. */
  agregarMovimiento: (m: Movimiento) => void;
};

const PatrimonioContext = createContext<Patrimonio | null>(null);

// Los movimientos viven en memoria: se pierden al recargar la página.
export function PatrimonioProvider({ children }: { children: React.ReactNode }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>(movimientosIniciales);

  const agregarMovimiento = useCallback(
    (m: Movimiento) => setMovimientos((actuales) => [...actuales, m]),
    [],
  );

  const valor = useMemo(
    () => ({ personas, bienes, movimientos, agregarMovimiento }),
    [movimientos, agregarMovimiento],
  );

  return <PatrimonioContext.Provider value={valor}>{children}</PatrimonioContext.Provider>;
}

export function usePatrimonio() {
  const ctx = useContext(PatrimonioContext);
  if (!ctx) throw new Error("usePatrimonio debe usarse dentro de PatrimonioProvider");
  return ctx;
}
