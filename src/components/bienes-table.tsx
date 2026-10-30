"use client";

import { useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { CondicionBadge, SituacionBadge } from "@/components/bienes-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BienDetalleSheet, type BienFicha } from "@/components/bien-detalle-sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Situacion } from "@/lib/patrimonio";

export type BienFila = {
  id: string;
  codigoPatrimonial: string;
  descripcion: string;
  detalle: string;
  responsable: string | null;
  ubicacion: string;
  situacion: Situacion;
  /** dd/mm/aaaa, o null si el bien migrado no tiene fecha */
  aCargoDesde: string | null;
  custodiaDe: string | null;
  ficha: BienFicha;
};

const FILTROS = [
  { value: "TODAS", label: "Todas las situaciones" },
  { value: "EN USO", label: "En uso" },
  { value: "EN REPARACION", label: "En reparación" },
  { value: "SIN ASIGNAR", label: "Sin asignar" },
];

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BienesTable({ filas }: { filas: BienFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [situacion, setSituacion] = useState("TODAS");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const abrir = (id: string) => {
    setSeleccionadoId(id);
    setPanelAbierto(true);
  };
  const seleccionado = filas.find((f) => f.id === seleccionadoId)?.ficha ?? null;

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return filas.filter((f) => {
      if (situacion !== "TODAS" && f.situacion !== situacion) return false;
      if (!q) return true;
      return normalizar(
        [f.codigoPatrimonial, f.descripcion, f.detalle, f.responsable ?? "", f.ubicacion].join(" "),
      ).includes(q);
    });
  }, [filas, busqueda, situacion]);

  const limpiar = () => {
    setBusqueda("");
    setSituacion("TODAS");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, descripción, responsable…"
            aria-label="Buscar bienes"
            className="h-10 bg-card pl-9"
          />
        </div>
        <Select
          value={situacion}
          onValueChange={(v) => setSituacion(v ?? "TODAS")}
          items={FILTROS}
        >
          <SelectTrigger className="h-10 w-full bg-card sm:w-56" aria-label="Filtrar por situación">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {visibles.length} de {filas.length} bienes
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-[#F9FAFB]">
            <TableRow className="hover:bg-transparent">
              {["Código patrimonial", "Descripción", "Responsable", "Ubicación", "Situación", "A su cargo desde", "Condición"].map((h) => (
                <TableHead key={h} className="h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <PackageSearch className="size-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No se encontraron bienes</p>
                    <Button variant="outline" size="sm" onClick={limpiar}>
                      Limpiar filtros
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((f) => (
                <TableRow
                  key={f.id}
                  tabIndex={0}
                  onClick={() => abrir(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrir(f.id);
                    }
                  }}
                  aria-label={`Ver detalle de ${f.descripcion} ${f.codigoPatrimonial}`}
                  className="cursor-pointer hover:bg-[#F9FAFB] focus-visible:bg-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <TableCell className="py-3 font-medium tabular-nums">{f.codigoPatrimonial}</TableCell>
                  <TableCell className="py-3">
                    <p className="text-[13.5px]">{f.descripcion}</p>
                    <p className="text-xs text-muted-foreground">{f.detalle}</p>
                  </TableCell>
                  <TableCell className="py-3 text-[13.5px]">
                    {f.responsable ?? (
                      <span className="text-muted-foreground italic">Sin responsable</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-[13.5px]">{f.ubicacion}</TableCell>
                  <TableCell className="py-3">
                    <SituacionBadge situacion={f.situacion} />
                  </TableCell>
                  <TableCell className="py-3 text-[13.5px] tabular-nums">
                    {f.aCargoDesde ?? (
                      <Tooltip>
                        <TooltipTrigger render={<span className="cursor-help text-muted-foreground" />}>
                          S/F
                        </TooltipTrigger>
                        <TooltipContent>Bien migrado sin fecha de asignación</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <CondicionBadge custodiaDe={f.custodiaDe} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BienDetalleSheet ficha={seleccionado} open={panelAbierto} onOpenChange={setPanelAbierto} />
    </div>
  );
}
