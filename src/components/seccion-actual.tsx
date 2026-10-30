"use client";

import { usePathname } from "next/navigation";

const secciones: Record<string, string> = {
  "/bienes": "Bienes",
  "/personas": "Personas",
  "/movimientos": "Movimientos",
};

export function SeccionActual() {
  const pathname = usePathname();
  const clave = Object.keys(secciones).find((k) => pathname.startsWith(k));
  return <>{clave ? secciones[clave] : "Bienes"}</>;
}
