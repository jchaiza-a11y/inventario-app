"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, Info, Users, X } from "lucide-react";
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
  errorDeBien,
  hoyDmy,
  prepararActa,
  type Errores,
} from "@/lib/movimientos";
import { calcularEstado, type TipoMovimiento } from "@/lib/patrimonio";

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

  // Datos comunes de la acta
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [nuevoResponsableId, setNuevoResponsableId] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [acta, setActa] = useState("");
  const [motivo, setMotivo] = useState("");
  // Bienes de la acta
  const [bienIds, setBienIds] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [avisoLote, setAvisoLote] = useState<string | null>(null);
  // Resultado de validar / guardar
  const [errores, setErrores] = useState<Errores>({});
  const [errorPorBien, setErrorPorBien] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<string | null>(null);

  // La fecha de hoy se calcula en el navegador para no desfasar servidor y cliente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFecha(hoyDmy());
  }, []);

  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? null;
  const enLista = useMemo(
    () => bienIds.map((id) => bienes.find((b) => b.id === id)!).filter(Boolean),
    [bienIds, bienes],
  );

  // Bienes que se pueden buscar: los que todavía no están en la lista.
  const itemsBien = useMemo<ItemBien[]>(
    () =>
      bienes
        .filter((b) => !bienIds.includes(b.id))
        .map((b) => ({ value: b.id, label: `${b.codigoPatrimonial} — ${b.descripcion}` })),
    [bienes, bienIds],
  );
  const opcionesTipo = TIPOS.map((t) => ({ value: t, label: t }));
  const opcionesResponsable = personas
    .filter((p) => p.activo)
    .map((p) => ({ value: p.id, label: `${p.nombre} — ${p.cargo}` }));
  const opcionesPersona = personas.map((p) => ({ value: p.id, label: `${p.nombre} — ${p.cargo}` }));
  const ubicacionesConocidas = useMemo(
    () =>
      Array.from(new Set([...bienes.map((b) => b.ubicacionInicial), ...movimientos.map((m) => m.ubicacion)])),
    [bienes, movimientos],
  );

  const limpiarResultado = () => {
    setErrores({});
    setErrorPorBien({});
  };

  const cambiarTipo = (t: TipoMovimiento | null) => {
    setTipo(t ?? "");
    setNuevoResponsableId("");
    setUbicacion("");
    setAvisoLote(null);
    limpiarResultado();
  };

  const agregarBienes = (ids: string[]) => {
    setBienIds((actuales) => [...actuales, ...ids.filter((id) => !actuales.includes(id))]);
    limpiarResultado();
  };

  const agregarDePersona = () => {
    if (!personaId) return;
    const suyos = bienes
      .filter((b) => calcularEstado(b, movimientos).responsableId === personaId)
      .map((b) => b.id);
    const nuevos = suyos.filter((id) => !bienIds.includes(id));
    if (suyos.length === 0) {
      setAvisoLote(`${nombre(personaId)} no tiene bienes a su cargo.`);
      return;
    }
    agregarBienes(nuevos);
    setAvisoLote(
      nuevos.length === 0
        ? `Los ${suyos.length} bienes de ${nombre(personaId)} ya estaban en la lista.`
        : `Se agregaron ${nuevos.length} ${nuevos.length === 1 ? "bien" : "bienes"} de ${nombre(personaId)}.`,
    );
  };

  const quitar = (id: string) => {
    setBienIds((actuales) => actuales.filter((x) => x !== id));
    limpiarResultado();
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setExito(null);

    const r = prepararActa(
      { tipo, bienes: enLista, nuevoResponsableId, ubicacion, fecha, acta, motivo },
      personas,
      movimientos,
    );
    if (!r.ok) {
      setErrores(r.errores);
      setErrorPorBien(r.porBien);
      return;
    }

    // Todo o nada: solo se llega aquí si todos los bienes pasaron las validaciones.
    r.movimientos.forEach(agregarMovimiento);
    const n = r.movimientos.length;
    setExito(
      `${n === 1 ? "Se registró 1 movimiento" : `Se registraron ${n} movimientos`} en el ${r.movimientos[0].acta}. Ya se reflejan en Bienes y Personas.`,
    );
    setTipo("");
    setNuevoResponsableId("");
    setUbicacion("");
    setActa("");
    setMotivo("");
    setBienIds([]);
    setAvisoLote(null);
    limpiarResultado();
  };

  const hayErroresDeBien = Object.keys(errorPorBien).length > 0;

  return (
    <form onSubmit={guardar} noValidate className="max-w-3xl space-y-6">
      {exito && (
        <Alert role="status" className="border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]">
          <CircleCheck />
          <AlertTitle>Acta registrada</AlertTitle>
          <AlertDescription className="text-[#067647]">{exito}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Datos de la acta</CardTitle>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="fecha" label="Fecha" error={errores.fecha}>
              <Input
                id="fecha"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  limpiarResultado();
                }}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
                aria-invalid={!!errores.fecha}
                className="h-10 bg-card tabular-nums"
              />
            </Campo>
            <Campo id="acta" label="N° de acta" error={errores.acta}>
              <Input
                id="acta"
                value={acta}
                onChange={(e) => {
                  setActa(e.target.value);
                  limpiarResultado();
                }}
                placeholder="Ej.: ACTA-0070-2026"
                aria-invalid={!!errores.acta}
                className="h-10 bg-card"
              />
            </Campo>
          </div>

          {tipo === "ASIGNACION" && (
            <Campo id="responsable" label="Nuevo responsable" error={errores.responsable}>
              <Select
                value={nuevoResponsableId || null}
                onValueChange={(v) => {
                  setNuevoResponsableId(v ?? "");
                  limpiarResultado();
                }}
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
              El responsable de cada bien no cambia.
            </p>
          )}

          {tipo === "PASE A CUSTODIA DEL JEFE INMEDIATO" && (
            <p className="rounded-lg border border-[#D9C8FA] bg-[#F4EBFF]/50 p-3 text-[13.5px] font-medium text-[#6941C6]">
              El nuevo responsable de cada bien se calcula con el jefe inmediato de su responsable actual.
            </p>
          )}

          {tipo && tipo !== "PASE A CUSTODIA DEL JEFE INMEDIATO" && (
            <Campo
              id="ubicacion"
              label={tipo === "REINGRESO DE REPARACION" ? "Ubicación donde quedan" : "Ubicación de destino"}
              error={errores.ubicacion}
            >
              <Input
                id="ubicacion"
                list="ubicaciones"
                value={ubicacion}
                onChange={(e) => {
                  setUbicacion(e.target.value);
                  limpiarResultado();
                }}
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

          <Campo id="motivo" label="Motivo" opcional>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="bg-card"
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Bienes de la acta ({enLista.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Campo id="bien" label="Agregar un bien">
            <Combobox
              items={itemsBien}
              value={null}
              inputValue={busqueda}
              onInputValueChange={(v, d) => {
                if (d.reason !== "item-press") setBusqueda(v);
              }}
              onValueChange={(item: ItemBien | null) => {
                if (item) agregarBienes([item.value]);
                setBusqueda("");
                setAvisoLote(null);
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

          <div className="space-y-1.5">
            <Label htmlFor="persona" className="text-[13.5px]">
              Agregar todos los bienes de una persona
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={personaId || null}
                onValueChange={(v) => {
                  setPersonaId(v ?? "");
                  setAvisoLote(null);
                }}
                items={opcionesPersona}
              >
                <SelectTrigger id="persona" className="h-10 w-full bg-card sm:flex-1">
                  <SelectValue placeholder="Elige a la persona" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesPersona.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" className="h-10" onClick={agregarDePersona} disabled={!personaId}>
                <Users className="size-4" />
                Agregar todos los bienes de una persona
              </Button>
            </div>
            {avisoLote && (
              <p role="status" className="text-xs text-muted-foreground">
                {avisoLote}
              </p>
            )}
          </div>

          {errores.bienes && (
            <p role="alert" className="text-xs text-[#B42318]">
              {errores.bienes}
            </p>
          )}

          {hayErroresDeBien && (
            <Alert variant="destructive" role="alert">
              <CircleX />
              <AlertTitle>No se guardó nada</AlertTitle>
              <AlertDescription>
                Corrige o quita los bienes marcados en rojo; la acta se guarda completa o no se guarda.
              </AlertDescription>
            </Alert>
          )}

          {enLista.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[13.5px] text-muted-foreground">
              Aún no hay bienes en la acta.
            </p>
          ) : (
            <ul className="space-y-2">
              {enLista.map((b) => {
                const estado = calcularEstado(b, movimientos);
                const error =
                  errorPorBien[b.id] ?? errorDeBien(tipo, estado, nuevoResponsableId, personas);
                return (
                  <li
                    key={b.id}
                    className={
                      error
                        ? "space-y-2 rounded-lg border border-[#FDA29B] bg-[#FEF3F2]/60 p-3"
                        : "space-y-2 rounded-lg border bg-[#F9FAFB] p-3"
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium tabular-nums">{b.codigoPatrimonial}</p>
                        <p className="text-[13.5px]">{b.descripcion}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => quitar(b.id)}
                        aria-label={`Quitar ${b.codigoPatrimonial} de la acta`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span>
                        Responsable:{" "}
                        <span className="text-foreground">
                          {nombre(estado.responsableId) ?? <em>Sin responsable</em>}
                        </span>
                      </span>
                      <span>
                        Ubicación: <span className="text-foreground">{estado.ubicacion}</span>
                      </span>
                      <SituacionBadge situacion={estado.situacion} />
                      {estado.custodiaDeId && <CondicionBadge custodiaDe={nombre(estado.custodiaDeId)} />}
                    </div>
                    {error && (
                      <p role="alert" className="text-xs font-medium text-[#B42318]">
                        {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="h-10 px-5">
        {enLista.length > 1 ? `Registrar ${enLista.length} movimientos` : "Registrar movimiento"}
      </Button>
    </form>
  );
}
