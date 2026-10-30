"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { CondicionBadge, SituacionBadge } from "@/components/bienes-badges";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TIPOS,
  errorDeTipo,
  hoyDmy,
  jefeDe,
  prepararMovimiento,
  type Errores,
} from "@/lib/movimientos";
import { calcularEstado, type TipoMovimiento } from "@/lib/patrimonio";
import { cn } from "@/lib/utils";

type ItemBien = { value: string; label: string };

function Campo({
  id,
  label,
  error,
  opcional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13.5px]">
        {label}
        {opcional && <span className="font-normal text-muted-foreground"> (opcional)</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}

export function MovimientoForm() {
  const { personas, bienes, movimientos, agregarMovimiento } = usePatrimonio();

  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [bienItem, setBienItem] = useState<ItemBien | null>(null);
  const [nuevoResponsableId, setNuevoResponsableId] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [acta, setActa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [exito, setExito] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0); // fuerza a vaciar el combobox

  // La fecha de hoy se calcula en el navegador para no desfasar servidor y cliente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFecha(hoyDmy());
  }, []);

  const itemsBien = useMemo<ItemBien[]>(
    () => bienes.map((b) => ({ value: b.id, label: `${b.codigoPatrimonial} — ${b.descripcion}` })),
    [bienes],
  );
  const bien = bienes.find((b) => b.id === bienItem?.value) ?? null;
  const estado = bien ? calcularEstado(bien, movimientos) : null;
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? null;

  const jefe = estado ? jefeDe(personas, estado.responsableId) : null;
  const errorTipo = estado ? errorDeTipo(tipo, estado, personas) : null;

  const opcionesTipo = TIPOS.map((t) => ({ value: t, label: t }));
  const opcionesResponsable = personas
    .filter((p) => p.activo && p.id !== estado?.responsableId)
    .map((p) => ({ value: p.id, label: `${p.nombre} — ${p.cargo}` }));
  const ubicacionesConocidas = useMemo(
    () =>
      Array.from(new Set([...bienes.map((b) => b.ubicacionInicial), ...movimientos.map((m) => m.ubicacion)])),
    [bienes, movimientos],
  );

  const cambiarTipo = (t: TipoMovimiento | null) => {
    setTipo(t ?? "");
    setNuevoResponsableId("");
    setUbicacion("");
    setErrores({});
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setExito(null);

    const r = prepararMovimiento(
      { tipo, bien, nuevoResponsableId, ubicacion, fecha, acta, motivo },
      personas,
      movimientos,
    );
    if (!r.ok) {
      setErrores(r.errores);
      return;
    }

    agregarMovimiento(r.movimiento);
    setExito(
      `${r.movimiento.tipo} registrado para ${bien!.codigoPatrimonial} — ${bien!.descripcion} (acta ${r.movimiento.acta}). Ya se refleja en Bienes y Personas.`,
    );
    setTipo("");
    setBienItem(null);
    setNuevoResponsableId("");
    setUbicacion("");
    setActa("");
    setMotivo("");
    setErrores({});
    setReinicio((n) => n + 1);
  };

  const mostrarError = errorTipo ?? errores.general;

  return (
    <form onSubmit={guardar} noValidate className="max-w-2xl space-y-6">
      {exito && (
        <Alert role="status" className="border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]">
          <CircleCheck />
          <AlertTitle>Movimiento registrado</AlertTitle>
          <AlertDescription className="text-[#067647]">{exito}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">¿Qué movimiento y de qué bien?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Campo id="tipo" label="Tipo de movimiento" error={errores.tipo}>
            <Select
              value={tipo || null}
              onValueChange={(v) => cambiarTipo(v as TipoMovimiento | null)}
              items={opcionesTipo}
            >
              <SelectTrigger id="tipo" className="h-10 w-full bg-card">
                <SelectValue placeholder="Elige el tipo" />
              </SelectTrigger>
              <SelectContent>
                {opcionesTipo.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo id="bien" label="Bien" error={errores.bien}>
            <Combobox
              key={reinicio}
              items={itemsBien}
              value={bienItem}
              onValueChange={(v) => {
                setBienItem(v);
                setErrores({});
              }}
            >
              <ComboboxInput
                id="bien"
                placeholder="Busca por código o descripción…"
                className="h-10 w-full bg-card"
              />
              <ComboboxContent>
                <ComboboxEmpty>No se encontraron bienes</ComboboxEmpty>
                <ComboboxList>
                  {(item: ItemBien) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Campo>

          {estado && (
            <div className="space-y-3 rounded-lg border bg-[#F9FAFB] p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                De dónde viene
              </p>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Responsable actual</dt>
                  <dd className="text-[13.5px]">
                    {nombre(estado.responsableId) ?? (
                      <span className="text-muted-foreground italic">Sin responsable</span>
                    )}
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Ubicación</dt>
                  <dd className="text-[13.5px]">{estado.ubicacion}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Situación</dt>
                  <dd>
                    <SituacionBadge situacion={estado.situacion} />
                  </dd>
                </div>
              </dl>
              {estado.custodiaDeId && <CondicionBadge custodiaDe={nombre(estado.custodiaDeId)} />}
            </div>
          )}

          {mostrarError && (
            <Alert variant="destructive" role="alert">
              <CircleX />
              <AlertTitle>No se puede registrar este movimiento</AlertTitle>
              <AlertDescription>{mostrarError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {tipo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Datos del movimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tipo === "ASIGNACION" && (
              <Campo id="responsable" label="Nuevo responsable" error={errores.responsable}>
                <Select
                  value={nuevoResponsableId || null}
                  onValueChange={(v) => setNuevoResponsableId(v ?? "")}
                  items={opcionesResponsable}
                >
                  <SelectTrigger id="responsable" className="h-10 w-full bg-card">
                    <SelectValue placeholder="Elige a la persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcionesResponsable.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            )}

            {(tipo === "SALIDA A REPARACION" || tipo === "REINGRESO DE REPARACION") && (
              <p className="flex items-start gap-2 text-[13.5px] text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                El responsable no cambia
                {estado && nombre(estado.responsableId) ? `: sigue siendo ${nombre(estado.responsableId)}.` : "."}
              </p>
            )}

            {tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO" && (
              <div className="space-y-1.5 rounded-lg border border-[#D9C8FA] bg-[#F4EBFF]/50 p-3">
                <p className="text-xs text-[#6941C6]">Nuevo responsable (calculado)</p>
                <p className="text-[13.5px] font-medium text-[#6941C6]">
                  {jefe
                    ? `${jefe.nombre} — jefe inmediato de ${nombre(estado!.responsableId)}`
                    : "Se calcula al elegir un bien con responsable y jefe inmediato."}
                </p>
              </div>
            )}

            {tipo !== "PASE A CUSTODIA DEL JEFE INMEDIATO" && (
              <Campo
                id="ubicacion"
                label={tipo === "REINGRESO DE REPARACION" ? "Ubicación donde queda" : "Ubicación de destino"}
                error={errores.ubicacion}
              >
                <Input
                  id="ubicacion"
                  list="ubicaciones"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder={tipo === "SALIDA A REPARACION" ? "Ej.: Servicio técnico externo" : "Ej.: Oficina de Abastecimiento"}
                  aria-invalid={!!errores.ubicacion}
                  className="h-10 bg-card"
                />
                <datalist id="ubicaciones">
                  {ubicacionesConocidas.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </Campo>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="fecha" label="Fecha" error={errores.fecha}>
                <Input
                  id="fecha"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  aria-invalid={!!errores.fecha}
                  className={cn("h-10 bg-card tabular-nums")}
                />
              </Campo>
              <Campo id="acta" label="N° de acta" error={errores.acta}>
                <Input
                  id="acta"
                  value={acta}
                  onChange={(e) => setActa(e.target.value)}
                  placeholder="Ej.: ACTA-0070-2026"
                  aria-invalid={!!errores.acta}
                  className="h-10 bg-card"
                />
              </Campo>
            </div>

            <Campo id="motivo" label="Motivo" opcional>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="bg-card"
              />
            </Campo>
          </CardContent>
        </Card>
      )}

      <Button type="submit" className="h-10 px-5" disabled={!!errorTipo}>
        Registrar movimiento
      </Button>
    </form>
  );
}
