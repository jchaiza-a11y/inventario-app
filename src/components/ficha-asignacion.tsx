"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Button } from "@/components/ui/button";
import { hoyDmy } from "@/lib/movimientos";
import { filasFicha } from "@/lib/vistas";
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
  "A su cargo desde",
  "Observaciones",
];

const NOTA =
  'El trabajador es responsable directo de la existencia, permanencia, conservación y buen uso de cada uno de los bienes descritos, por lo que debe tomar las providencias del caso para evitar pérdida, sustracción, deterioro, etc., que de ocurrir deberá ser comunicado al encargado de Control Patrimonial, bajo responsabilidad. Los bienes marcados "EN CUSTODIA" se reciben de forma temporal, por cuenta del trabajador indicado, hasta su reasignación.';

const FIRMAS = ["FIRMA DEL USUARIO", "PRESIDENTE DE LA COMISIÓN DE INVENTARIOS", "CONTROL PATRIMONIAL"];

const celda = "border border-black px-1.5 py-1";

export function FichaAsignacion({ personaId }: { personaId: string }) {
  const { entidad, personas, bienes, movimientos } = usePatrimonio();
  const persona = personas.find((p) => p.id === personaId) ?? null;
  const [emision, setEmision] = useState("");

  // La fecha de hoy se calcula en el navegador para no desfasar servidor y cliente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmision(hoyDmy());
  }, []);

  const filas = useMemo(
    () => filasFicha(personaId, bienes, movimientos, personas),
    [personaId, bienes, movimientos, personas],
  );

  if (!persona) {
    return (
      <div className="space-y-4">
        <p className="text-sm">No se encontró a la persona solicitada.</p>
        <Button variant="outline" render={<Link href="/personas" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
          Volver a Personas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" render={<Link href="/personas" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
          Volver a Personas
        </Button>
        <Button className="sm:ml-auto" onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir
        </Button>
      </div>

      {/* Hoja A4 apaisada: en pantalla es la vista previa; al imprimir, la página. */}
      <div className="overflow-x-auto print:overflow-visible">
        <article
          className={cn(
            "mx-auto w-[297mm] min-w-[297mm] bg-white p-[12mm] text-[11px] leading-snug text-black",
            "border shadow-sm print:w-auto print:min-w-0 print:border-0 print:p-0 print:shadow-none",
            "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
          )}
        >
          <header className="space-y-1 text-center">
            <h1 className="text-[15px] font-semibold tracking-wide">
              FICHA DE ASIGNACIÓN DE BIENES EN USO
            </h1>
            <p className="text-[12px]">{entidad}</p>
          </header>

          <section className="mt-4 grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1 border border-black p-2">
            <span className="font-semibold">Nombres y apellidos:</span>
            <span>{persona.nombre}</span>
            <span className="font-semibold">Fecha de emisión:</span>
            <span className="tabular-nums">{emision}</span>
            <span className="font-semibold">Cargo:</span>
            <span>{persona.cargo}</span>
            <span className="font-semibold">Oficina:</span>
            <span>{persona.oficina}</span>
          </section>

          {filas.length === 0 ? (
            <p className="mt-4 border border-dashed border-black p-6 text-center text-[12px]">
              {persona.nombre} no tiene bienes a su cargo, por lo que no hay nada que detallar en esta ficha.
            </p>
          ) : (
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
                {filas.map((f) => (
                  <tr
                    key={f.codigoPatrimonial}
                    className={cn("[break-inside:avoid]", f.custodiaDe && "bg-[#F4EBFF]")}
                  >
                    <td className={cn(celda, "text-center tabular-nums")}>{f.item}</td>
                    <td className={cn(celda, "whitespace-nowrap tabular-nums")}>{f.codigoPatrimonial}</td>
                    <td className={celda}>{f.denominacion}</td>
                    <td className={celda}>{f.marca}</td>
                    <td className={celda}>{f.modelo}</td>
                    <td className={celda}>{f.serie}</td>
                    <td className={celda}>{f.medida}</td>
                    <td className={celda}>{f.color}</td>
                    <td className={cn(celda, "text-center")}>{f.estado}</td>
                    <td className={cn(celda, "tabular-nums")}>{f.aCargoDesde ?? "S/F"}</td>
                    <td className={cn(celda, "font-semibold")}>
                      {f.custodiaDe ? `EN CUSTODIA DE: ${f.custodiaDe}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Leyenda, nota y firmas van juntas al final y no se parten entre páginas. */}
          <div className="mt-4 space-y-3 [break-inside:avoid]">
            <p className="font-semibold">
              (N) NUEVO &nbsp;&nbsp; (B) BUENO &nbsp;&nbsp; (R) REGULAR &nbsp;&nbsp; (M) MALO
            </p>
            <p className="text-justify">{NOTA}</p>

            <div className="grid grid-cols-3 gap-10 pt-14">
              {FIRMAS.map((f) => (
                <div key={f} className="border-t border-black pt-1 text-center font-semibold">
                  {f}
                </div>
              ))}
            </div>

            <p className="pt-2 text-center text-[9px] text-neutral-600">
              Sistema de Control Patrimonial · Creación de Jesús R. Chaiza Flores
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
