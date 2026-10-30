"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resumenActas } from "@/lib/movimientos";
import { cn } from "@/lib/utils";

export function ActasTable() {
  const { movimientos } = usePatrimonio();
  const actas = useMemo(() => resumenActas(movimientos), [movimientos]);

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-[#F9FAFB]">
          <TableRow className="hover:bg-transparent">
            {["N° de acta", "Tipo", "Fecha"].map((h) => (
              <TableHead key={h} className="h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {h}
              </TableHead>
            ))}
            <TableHead className="h-10 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Bienes
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Acta
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actas.map((a) => {
            const custodia = a.tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO";
            return (
              <TableRow key={a.clave} className="hover:bg-[#F9FAFB]">
                <TableCell className="py-3 text-[13.5px] font-medium">{a.acta}</TableCell>
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 px-2.5",
                      custodia ? "border-[#D9C8FA] bg-[#F4EBFF] text-[#6941C6]" : "bg-[#F2F4F7] text-[#475467]",
                    )}
                  >
                    {a.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-[13.5px] tabular-nums">
                  {a.fecha.split("-").reverse().join("/")}
                </TableCell>
                <TableCell className="py-3 text-right text-[13.5px] tabular-nums">{a.cantidad}</TableCell>
                <TableCell className="py-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/movimientos/actas/${encodeURIComponent(a.acta)}`} />}
                    nativeButton={false}
                  >
                    Ver acta
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
