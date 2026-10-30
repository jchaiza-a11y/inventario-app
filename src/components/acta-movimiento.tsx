"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BarraImpresion, HojaA4, LeyendaEstados, PIE_SISTEMA, celda } from "@/components/hoja-impresion";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Button } from "@/components/ui/button";
import { datosActa } from "@/lib/vistas";
import { cn } from "@/lib/utils";

const COLUMNAS = [
  "Ítem",
  "Código patrimonial",
  "Denominación",
  "Marca",
  "Modelo",
  "Serie",
  "Medida",
  "Color",
  "Estado",
  "Observaciones",
];

const NOTA =
  "Quien recibe los bienes descritos es responsable de su existencia, conservación y buen uso hasta su devolución o nueva asignación. Cualquier pérdida, deterioro o novedad debe comunicarse de inmediato a Control Patrimonial, bajo responsabilidad.";

export function ActaMovimiento({ numero }: { numero: string }) {
  const { entidad, personas, bienes, movimientos } = usePatrimonio();
  const acta = useMemo(
    () => datosActa(numero, bienes, movimientos, personas),
    [numero, bienes, movimientos, personas],
  );

  if (!acta) {
    return (
      <div className="space-y-4">
        <p className="text-sm">No se encontró el acta {numero}.</p>
        <Button variant="outline" render={<Link href="/movimientos" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
          Volver a Movimientos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BarraImpresion volverHref="/movimientos" volverTexto="Volver a Movimientos" />

      <HojaA4>
        <header className="space-y-1 text-center">
          <h1 className="text-[15px] font-semibold tracking-wide">{acta.titulo}</h1>
          <p className="text-[12px]">{entidad}</p>
        </header>

        <section className="mt-4 grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1 border border-black p-2">
          <span className="font-semibold">N° de acta:</span>
          <span>{acta.acta}</span>
          <span className="font-semibold">Fecha:</span>
          <span className="tabular-nums">{acta.fecha}</span>
          <span className="font-semibold">Tipo de movimiento:</span>
          <span>{acta.tipo}</span>
          <span className="font-semibold">Ubicación / destino:</span>
          <span>{acta.ubicacion}</span>
          <span className="font-semibold">Entrega:</span>
          <span>{acta.entrega}</span>
          <span className="font-semibold">Recibe:</span>
          <span>{acta.recibe}</span>
          {acta.motivo && (
            <>
              <span className="font-semibold">Motivo:</span>
              <span className="col-span-3">{acta.motivo}</span>
            </>
          )}
        </section>

        <table className="mt-4 w-full border-collapse text-[10px]">
          <thead className="[display:table-header-group]">
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c} className={cn(celda, "bg-[#F2F4F7] text-left font-semibold")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {acta.filas.map((f) => (
              <tr key={f.codigoPatrimonial} className={cn("[break-inside:avoid]", f.custodiaDe && "bg-[#F4EBFF]")}>
                <td className={cn(celda, "text-center tabular-nums")}>{f.item}</td>
                <td className={cn(celda, "whitespace-nowrap tabular-nums")}>{f.codigoPatrimonial}</td>
                <td className={celda}>{f.denominacion}</td>
                <td className={celda}>{f.marca}</td>
                <td className={celda}>{f.modelo}</td>
                <td className={celda}>{f.serie}</td>
                <td className={celda}>{f.medida}</td>
                <td className={celda}>{f.color}</td>
                <td className={cn(celda, "text-center")}>{f.estado}</td>
                <td className={cn(celda, "font-semibold")}>
                  {f.custodiaDe ? `EN CUSTODIA DE: ${f.custodiaDe}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Leyenda, nota y firmas van juntas al final y no se parten entre páginas. */}
        <div className="mt-4 space-y-3 [break-inside:avoid]">
          <LeyendaEstados />
          <p className="text-justify">{NOTA}</p>

          <div className="grid grid-cols-3 gap-10 pt-14">
            <div className="border-t border-black pt-1 text-center">
              <p className="font-semibold">ENTREGA</p>
              <p>{acta.entrega}</p>
            </div>
            <div className="border-t border-black pt-1 text-center">
              <p className="font-semibold">RECIBE</p>
              <p>{acta.recibe}</p>
            </div>
            <div className="border-t border-black pt-1 text-center">
              <p className="font-semibold">CONTROL PATRIMONIAL</p>
            </div>
          </div>

          <p className="pt-2 text-center text-[9px] text-neutral-600">{PIE_SISTEMA}</p>
        </div>
      </HojaA4>
    </div>
  );
}
