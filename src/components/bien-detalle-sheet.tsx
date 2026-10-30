"use client";

import { ArrowRight, MapPin, FileText } from "lucide-react";
import { CondicionBadge, SituacionBadge } from "@/components/bienes-badges";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EstadoConservacion, Situacion, TipoMovimiento } from "@/lib/patrimonio";
import { cn } from "@/lib/utils";

export type MovimientoFila = {
  id: string;
  fecha: string; // dd/mm/aaaa
  tipo: TipoMovimiento;
  de: string | null;
  a: string | null;
  ubicacion: string;
  acta: string;
};

export type BienFicha = {
  datos: {
    codigoPatrimonial: string;
    descripcion: string;
    marca: string;
    modelo: string;
    serie: string;
    medidas: string;
    color: string;
    estado: EstadoConservacion;
  };
  actual: {
    responsable: string | null;
    ubicacion: string;
    situacion: Situacion;
    aCargoDesde: string | null;
    custodiaDe: string | null;
  };
  /** Del más reciente al más antiguo. */
  movimientos: MovimientoFila[];
};

const ESTADOS: Record<EstadoConservacion, string> = {
  N: "N — Nuevo",
  B: "B — Bueno",
  R: "R — Regular",
  M: "M — Malo",
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-[13.5px]">{children}</dd>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

export function BienDetalleSheet({
  ficha,
  open,
  onOpenChange,
}: {
  ficha: BienFicha | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-card p-0 sm:max-w-lg">
        {ficha && (
          <>
            <SheetHeader className="border-b p-5">
              <SheetTitle className="text-lg font-semibold">{ficha.datos.descripcion}</SheetTitle>
              <SheetDescription className="tabular-nums">
                {ficha.datos.codigoPatrimonial}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-5">
              <Seccion titulo="Datos del bien">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Campo label="Código patrimonial">
                    <span className="font-medium tabular-nums">{ficha.datos.codigoPatrimonial}</span>
                  </Campo>
                  <Campo label="Estado">{ESTADOS[ficha.datos.estado]}</Campo>
                  <div className="col-span-2">
                    <Campo label="Descripción">{ficha.datos.descripcion}</Campo>
                  </div>
                  <Campo label="Marca">{ficha.datos.marca}</Campo>
                  <Campo label="Modelo">{ficha.datos.modelo}</Campo>
                  <Campo label="Serie">{ficha.datos.serie}</Campo>
                  <Campo label="Color">{ficha.datos.color}</Campo>
                  <div className="col-span-2">
                    <Campo label="Medidas">{ficha.datos.medidas}</Campo>
                  </div>
                </dl>
              </Seccion>

              <Separator />

              <Seccion titulo="Estado actual">
                {ficha.actual.custodiaDe && (
                  <p className="rounded-lg border border-[#D9C8FA] bg-[#F4EBFF] px-3 py-2 text-[13.5px] font-medium text-[#6941C6]">
                    En custodia por cuenta de {ficha.actual.custodiaDe}
                  </p>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Campo label="Responsable">
                    {ficha.actual.responsable ?? (
                      <span className="text-muted-foreground italic">Sin responsable</span>
                    )}
                  </Campo>
                  <Campo label="Ubicación">{ficha.actual.ubicacion}</Campo>
                  <Campo label="Situación">
                    <SituacionBadge situacion={ficha.actual.situacion} />
                  </Campo>
                  <Campo label="A su cargo desde">
                    {ficha.actual.aCargoDesde ?? (
                      <span className="text-muted-foreground">S/F</span>
                    )}
                  </Campo>
                  <Campo label="Condición">
                    <CondicionBadge custodiaDe={ficha.actual.custodiaDe} />
                  </Campo>
                </dl>
              </Seccion>

              <Separator />

              <Seccion titulo="Línea de tiempo">
                {ficha.movimientos.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[13.5px] text-muted-foreground">
                    Este bien no tiene movimientos: solo tiene su asignación inicial.
                  </p>
                ) : (
                  <ol className="space-y-5 border-l pl-5">
                    {ficha.movimientos.map((m) => {
                      const custodia = m.tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO";
                      return (
                        <li key={m.id} className="relative space-y-1.5">
                          <span
                            aria-hidden
                            className={cn(
                              "absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card",
                              custodia ? "bg-[#6941C6]" : "bg-primary",
                            )}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-medium tabular-nums">{m.fecha}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-6 px-2.5",
                                custodia
                                  ? "border-[#D9C8FA] bg-[#F4EBFF] text-[#6941C6]"
                                  : "bg-[#F2F4F7] text-[#475467]",
                              )}
                            >
                              {m.tipo}
                            </Badge>
                          </div>
                          <p className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
                            <span className={m.de ? "" : "text-muted-foreground italic"}>
                              {m.de ?? "Sin responsable"}
                            </span>
                            <ArrowRight className="size-3.5 text-muted-foreground" aria-label="a" />
                            <span className={m.a ? "" : "text-muted-foreground italic"}>
                              {m.a ?? "Sin responsable"}
                            </span>
                          </p>
                          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5" />
                              {m.ubicacion}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <FileText className="size-3.5" />
                              {m.acta}
                            </span>
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Seccion>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
