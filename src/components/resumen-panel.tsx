"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcularEstado, compararIds } from "@/lib/patrimonio";
import { cn } from "@/lib/utils";

const dmy = (iso: string) => iso.split("-").reverse().join("/");
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function Tarjeta({
  titulo,
  valor,
  punto,
  className,
}: {
  titulo: string;
  valor: number;
  punto?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="space-y-1">
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {punto && <span aria-hidden className={cn("size-2 rounded-full", punto)} />}
          {titulo}
        </p>
        <p className="text-3xl font-semibold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}

export function ResumenPanel() {
  const { personas, bienes, movimientos } = usePatrimonio();
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? null;

  const estados = useMemo(
    () => bienes.map((bien) => ({ bien, estado: calcularEstado(bien, movimientos) })),
    [bienes, movimientos],
  );

  const enUso = estados.filter((x) => x.estado.situacion === "EN USO");
  const enReparacion = estados.filter((x) => x.estado.situacion === "EN REPARACION");
  const sinAsignar = estados.filter((x) => x.estado.situacion === "SIN ASIGNAR");
  const enCustodia = estados.filter((x) => x.estado.custodiaDeId !== null);

  // Personas cesadas que todavía tienen bienes a su cargo.
  const cesadasConBienes = personas
    .filter((p) => !p.activo)
    .map((p) => ({ persona: p, cantidad: estados.filter((x) => x.estado.responsableId === p.id).length }))
    .filter((x) => x.cantidad > 0);

  const sinAlertas = cesadasConBienes.length === 0 && sinAsignar.length === 0 && enReparacion.length === 0;

  const ultimos = useMemo(
    () => [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha) || compararIds(b.id, a.id)).slice(0, 5),
    [movimientos],
  );

  return (
    <div className="space-y-8">
      <section aria-label="Totales" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta titulo="Total de bienes" valor={bienes.length} />
        <Tarjeta titulo="En uso" valor={enUso.length} punto="bg-[#12B76A]" />
        <Tarjeta titulo="En reparación" valor={enReparacion.length} punto="bg-[#F79009]" />
        <Tarjeta titulo="Sin asignar" valor={sinAsignar.length} punto="bg-[#F04438]" />
        <Tarjeta
          titulo="En custodia temporal"
          valor={enCustodia.length}
          punto="bg-[#6941C6]"
          className="bg-[#F4EBFF]/60 ring-[#D9C8FA]"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Alertas</h2>

        {sinAlertas && (
          <Alert className="bg-[#F9FAFB]">
            <CircleCheck />
            <AlertTitle>Sin alertas por ahora</AlertTitle>
          </Alert>
        )}

        {cesadasConBienes.map(({ persona, cantidad }) => {
          const jefe = nombre(persona.jefeId);
          return (
            <Alert key={persona.id} className="border-[#FEC84B] bg-[#FFFAEB] text-[#B54708]">
              <TriangleAlert />
              <AlertTitle>
                {persona.nombre} (CESADO) tiene {plural(cantidad, "bien", "bienes")} a su cargo
              </AlertTitle>
              <AlertDescription className="text-[#B54708]">
                {jefe
                  ? `Debe recibirlos su jefe inmediato: ${jefe}.`
                  : "No tiene jefe inmediato registrado."}{" "}
                <Link href="/personas" className="font-medium underline underline-offset-2">
                  Ver en Personas
                </Link>
              </AlertDescription>
            </Alert>
          );
        })}

        {sinAsignar.length > 0 && (
          <Alert className="border-[#FDA29B] bg-[#FEF3F2] text-[#B42318]">
            <TriangleAlert />
            <AlertTitle>{plural(sinAsignar.length, "bien sin asignar", "bienes sin asignar")}</AlertTitle>
            <AlertDescription className="text-[#B42318]">
              <ul className="list-inside list-disc">
                {sinAsignar.map(({ bien, estado }) => (
                  <li key={bien.id}>
                    <span className="tabular-nums">{bien.codigoPatrimonial}</span> — {bien.descripcion} ({estado.ubicacion})
                  </li>
                ))}
              </ul>
              <Link href="/bienes" className="font-medium underline underline-offset-2">
                Ver en Bienes
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {enReparacion.length > 0 && (
          <Alert className="border-[#FEC84B] bg-[#FFFAEB] text-[#B54708]">
            <TriangleAlert />
            <AlertTitle>{plural(enReparacion.length, "bien en reparación", "bienes en reparación")}</AlertTitle>
            <AlertDescription className="text-[#B54708]">
              <ul className="list-inside list-disc">
                {enReparacion.map(({ bien, estado }) => (
                  <li key={bien.id}>
                    <span className="tabular-nums">{bien.codigoPatrimonial}</span> — {bien.descripcion} en {estado.ubicacion}
                    {nombre(estado.responsableId) ? ` (responsable: ${nombre(estado.responsableId)})` : ""}
                  </li>
                ))}
              </ul>
              <Link href="/bienes" className="font-medium underline underline-offset-2">
                Ver en Bienes
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Últimos movimientos</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-[#F9FAFB]">
              <TableRow className="hover:bg-transparent">
                {["Acta", "Tipo", "Fecha", "Bien"].map((h) => (
                  <TableHead key={h} className="h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimos.map((m) => {
                const bien = bienes.find((b) => b.id === m.bienId);
                const custodia = m.tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO";
                return (
                  <TableRow key={m.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="py-3 text-[13.5px] font-medium">
                      <Link
                        href={`/movimientos/actas/${encodeURIComponent(m.acta)}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {m.acta}
                      </Link>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-6 px-2.5",
                          custodia ? "border-[#D9C8FA] bg-[#F4EBFF] text-[#6941C6]" : "bg-[#F2F4F7] text-[#475467]",
                        )}
                      >
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-[13.5px] tabular-nums">{dmy(m.fecha)}</TableCell>
                    <TableCell className="py-3 text-[13.5px]">
                      {bien ? (
                        <>
                          <span className="tabular-nums">{bien.codigoPatrimonial}</span>
                          <span className="text-muted-foreground"> · {bien.descripcion}</span>
                        </>
                      ) : (
                        m.bienId
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
