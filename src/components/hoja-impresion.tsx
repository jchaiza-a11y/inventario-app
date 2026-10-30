"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Clases de las celdas de las tablas de los documentos impresos. */
export const celda = "border border-black px-1.5 py-1";

export const PIE_SISTEMA = "Sistema de Control Patrimonial · Creación de Jesús R. Chaiza Flores";

/** Barra con "Volver" e "Imprimir"; no se imprime. */
export function BarraImpresion({ volverHref, volverTexto }: { volverHref: string; volverTexto: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="outline" render={<Link href={volverHref} />} nativeButton={false}>
        <ArrowLeft className="size-4" />
        {volverTexto}
      </Button>
      <Button className="sm:ml-auto" onClick={() => window.print()}>
        <Printer className="size-4" />
        Imprimir
      </Button>
    </div>
  );
}

/** Hoja A4 apaisada: en pantalla es la vista previa; al imprimir, la página. */
export function HojaA4({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <article
        className={cn(
          "mx-auto w-[297mm] min-w-[297mm] bg-white p-[12mm] text-[11px] leading-snug text-black",
          "border shadow-sm print:w-auto print:min-w-0 print:border-0 print:p-0 print:shadow-none",
          "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
        )}
      >
        {children}
      </article>
    </div>
  );
}

export function LeyendaEstados() {
  return (
    <p className="font-semibold">
      (N) NUEVO &nbsp;&nbsp; (B) BUENO &nbsp;&nbsp; (R) REGULAR &nbsp;&nbsp; (M) MALO
    </p>
  );
}
