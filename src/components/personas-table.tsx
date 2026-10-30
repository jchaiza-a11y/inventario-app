"use client";

import { useMemo, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { CondicionBadge, SituacionBadge } from "@/components/bienes-badges";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Situacion } from "@/lib/patrimonio";
import { filasPersonas } from "@/lib/vistas";
import { cn } from "@/lib/utils";

export type BienPersona = {
  id: string;
  codigoPatrimonial: string;
  descripcion: string;
  ubicacion: string;
  situacion: Situacion;
  aCargoDesde: string | null; // dd/mm/aaaa
  /** Nombre del trabajador original si el bien está en custodia. */
  custodiaDe: string | null;
};

export type PersonaFila = {
  id: string;
  nombre: string;
  cargo: string;
  jefe: string | null;
  activo: boolean;
  /** Propios primero, custodia después. */
  bienes: BienPersona[];
};

const esCustodia = (b: BienPersona) => b.custodiaDe !== null;

function CondicionPersona({ activo }: { activo: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-6 gap-1.5 px-2.5",
        activo ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#FEF3F2] text-[#B42318]",
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", activo ? "bg-[#12B76A]" : "bg-[#F04438]")}
      />
      {activo ? "ACTIVO" : "CESADO"}
    </Badge>
  );
}

/** Texto de la alerta de persona cesada, con concordancia singular/plural. */
function mensajeCesado(n: number, jefe: string | null) {
  const uno = n === 1;
  const sujeto = uno ? "Su bien" : `Sus ${n} bienes`;
  return jefe
    ? `${sujeto} ${uno ? "debe ser recibido" : "deben ser recibidos"} por su jefe inmediato: ${jefe}.`
    : `${sujeto} ${uno ? "sigue" : "siguen"} a su cargo y no tiene jefe inmediato registrado.`;
}

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

export function PersonasTable() {
  const { bienes, movimientos, personas: listaPersonas } = usePatrimonio();
  const personas = useMemo(
    () => filasPersonas(bienes, movimientos, listaPersonas),
    [bienes, movimientos, listaPersonas],
  );
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const abrir = (id: string) => {
    setSeleccionadaId(id);
    setPanelAbierto(true);
  };
  const persona = personas.find((p) => p.id === seleccionadaId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-[#F9FAFB]">
            <TableRow className="hover:bg-transparent">
              {["Nombre", "Cargo", "Jefe inmediato", "Condición"].map((h) => (
                <TableHead key={h} className="h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {h}
                </TableHead>
              ))}
              {["Bienes propios", "Bienes en custodia"].map((h) => (
                <TableHead key={h} className="h-10 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {personas.map((p) => {
              const propios = p.bienes.filter((b) => !esCustodia(b)).length;
              const custodia = p.bienes.length - propios;
              return (
                <TableRow
                  key={p.id}
                  tabIndex={0}
                  onClick={() => abrir(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrir(p.id);
                    }
                  }}
                  aria-label={`Ver detalle de ${p.nombre}`}
                  className="cursor-pointer hover:bg-[#F9FAFB] focus-visible:bg-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <TableCell className="py-3 text-[13.5px] font-medium">{p.nombre}</TableCell>
                  <TableCell className="py-3 text-[13.5px]">{p.cargo}</TableCell>
                  <TableCell className="py-3 text-[13.5px]">
                    {p.jefe ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="py-3">
                    <CondicionPersona activo={p.activo} />
                  </TableCell>
                  <TableCell className="py-3 text-right text-[13.5px] tabular-nums">{propios}</TableCell>
                  <TableCell
                    className={cn(
                      "py-3 text-right text-[13.5px] tabular-nums",
                      custodia > 0 && "font-medium text-[#6941C6]",
                    )}
                  >
                    {custodia}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={panelAbierto} onOpenChange={setPanelAbierto}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-card p-0 sm:max-w-lg">
          {persona && <DetallePersona persona={persona} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetallePersona({ persona }: { persona: PersonaFila }) {
  const propios = persona.bienes.filter((b) => !esCustodia(b));
  const custodia = persona.bienes.filter(esCustodia);

  return (
    <>
      <SheetHeader className="border-b p-5">
        <SheetTitle className="text-lg font-semibold">{persona.nombre}</SheetTitle>
        <SheetDescription>{persona.cargo}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        {!persona.activo &&
          (persona.bienes.length > 0 ? (
            <Alert className="border-[#FEC84B] bg-[#FFFAEB] text-[#B54708]">
              <TriangleAlert />
              <AlertTitle>Persona cesada con bienes a su cargo</AlertTitle>
              <AlertDescription className="text-[#B54708]">
                {mensajeCesado(persona.bienes.length, persona.jefe)}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-[#F9FAFB]">
              <CircleCheck />
              <AlertTitle>Sin bienes pendientes</AlertTitle>
            </Alert>
          ))}

        <Seccion titulo="Datos de la persona">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <Campo label="Nombre">{persona.nombre}</Campo>
            </div>
            <Campo label="Cargo">{persona.cargo}</Campo>
            <Campo label="Jefe inmediato">
              {persona.jefe ?? <span className="text-muted-foreground">—</span>}
            </Campo>
            <Campo label="Condición">
              <CondicionPersona activo={persona.activo} />
            </Campo>
          </dl>
        </Seccion>

        <Separator />

        <Seccion titulo={`Bienes a su cargo (${persona.bienes.length})`}>
          {persona.bienes.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[13.5px] text-muted-foreground">
              No tiene bienes a su cargo.
            </p>
          ) : (
            <div className="space-y-5">
              <ListaBienes titulo="Propios" bienes={propios} />
              <ListaBienes titulo="En custodia" bienes={custodia} lila />
            </div>
          )}
        </Seccion>
      </div>
    </>
  );
}

function ListaBienes({
  titulo,
  bienes,
  lila = false,
}: {
  titulo: string;
  bienes: BienPersona[];
  lila?: boolean;
}) {
  if (bienes.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className={cn("text-[13.5px] font-medium", lila && "text-[#6941C6]")}>
        {titulo} ({bienes.length})
      </p>
      <ul className="space-y-2">
        {bienes.map((b) => (
          <li
            key={b.id}
            className={cn(
              "space-y-1.5 rounded-lg border p-3",
              lila && "border-[#D9C8FA] bg-[#F4EBFF]/50",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-medium tabular-nums">{b.codigoPatrimonial}</span>
              <SituacionBadge situacion={b.situacion} />
            </div>
            <p className="text-[13.5px]">{b.descripcion}</p>
            <p className="text-xs text-muted-foreground">
              {b.ubicacion} · A su cargo desde: {b.aCargoDesde ?? "S/F"}
            </p>
            {b.custodiaDe && <CondicionBadge custodiaDe={b.custodiaDe} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
