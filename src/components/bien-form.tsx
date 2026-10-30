"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { usePatrimonio } from "@/components/patrimonio-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_CANTIDAD,
  cantidadValida,
  codigosNuevos,
  prepararBienes,
  type ErroresBien,
} from "@/lib/bienes";
import type { EstadoConservacion } from "@/lib/patrimonio";

const ESTADOS: { value: EstadoConservacion; label: string }[] = [
  { value: "N", label: "N — Nuevo" },
  { value: "B", label: "B — Bueno" },
  { value: "R", label: "R — Regular" },
  { value: "M", label: "M — Malo" },
];

const SIN_RESPONSABLE = "NINGUNO";

function Campo({
  id,
  label,
  error,
  opcional,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  opcional?: boolean;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13.5px]">
        {label}
        {opcional && <span className="font-normal text-muted-foreground"> (opcional)</span>}
      </Label>
      {children}
      {ayuda && !error && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && (
        <p role="alert" className="text-xs text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}

export function BienForm() {
  const { catalogo, personas, bienes, movimientos, agregarBienes } = usePatrimonio();

  const [codigoTipo, setCodigoTipo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [serie, setSerie] = useState("");
  const [medidas, setMedidas] = useState("");
  const [color, setColor] = useState("");
  const [estado, setEstado] = useState<EstadoConservacion | "">("");
  const [responsableId, setResponsableId] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [errores, setErrores] = useState<ErroresBien>({});
  const [registrados, setRegistrados] = useState<string[] | null>(null);

  const tipo = catalogo.find((c) => c.codigo === codigoTipo) ?? null;
  const opcionesTipo = catalogo.map((c) => ({ value: c.codigo, label: c.denominacion }));
  const opcionesResponsable = [
    { value: SIN_RESPONSABLE, label: "Sin responsable (queda SIN ASIGNAR)" },
    ...personas.filter((p) => p.activo).map((p) => ({ value: p.id, label: `${p.nombre} — ${p.cargo}` })),
  ];
  const ubicacionesConocidas = useMemo(
    () => Array.from(new Set([...bienes.map((b) => b.ubicacionInicial), ...movimientos.map((m) => m.ubicacion)].filter(Boolean))),
    [bienes, movimientos],
  );

  // Vista previa: los códigos de 12 dígitos que se generarían, antes de guardar.
  const n = cantidadValida(cantidad);
  const codigos = tipo && n !== null ? codigosNuevos(bienes, tipo.codigo, n) : null;

  const limpiar = () => {
    setErrores({});
    setRegistrados(null);
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const r = prepararBienes(
      { tipo, marca, modelo, serie, medidas, color, estado, responsableId, ubicacion, cantidad },
      bienes,
      personas,
    );
    if (!r.ok) {
      setErrores(r.errores);
      setRegistrados(null);
      return;
    }
    agregarBienes(r.bienes);
    setRegistrados(r.bienes.map((b) => b.codigoPatrimonial));
    setErrores({});
    // Se vacían los datos del bien; el formulario queda listo para el siguiente.
    setCodigoTipo("");
    setMarca("");
    setModelo("");
    setSerie("");
    setMedidas("");
    setColor("");
    setEstado("");
    setResponsableId("");
    setUbicacion("");
    setCantidad("1");
  };

  return (
    <form onSubmit={guardar} noValidate className="max-w-3xl space-y-6">
      {registrados && (
        <Alert role="status" className="border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]">
          <CircleCheck />
          <AlertTitle>
            {registrados.length === 1 ? "Se registró 1 bien" : `Se registraron ${registrados.length} bienes`}
          </AlertTitle>
          <AlertDescription className="text-[#067647]">
            <p className="tabular-nums">Códigos generados: {registrados.join(", ")}</p>
            <Link href="/bienes" className="font-medium underline underline-offset-2">
              Ver en Bienes
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Datos del bien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Campo id="tipo" label="Tipo de bien" error={errores.tipo}>
              <Select
                value={codigoTipo || null}
                onValueChange={(v) => {
                  setCodigoTipo(v ?? "");
                  limpiar();
                }}
                items={opcionesTipo}
              >
                <SelectTrigger id="tipo" className="h-10 w-full bg-card">
                  <SelectValue placeholder="Elige el tipo de bien" />
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
            <div className="space-y-1.5 sm:w-44">
              <Label className="text-[13.5px]">Código de catálogo</Label>
              <p
                aria-live="polite"
                className="flex h-10 items-center rounded-lg border bg-[#F9FAFB] px-3 text-[13.5px] tabular-nums"
              >
                {tipo ? tipo.codigo : <span className="text-muted-foreground">—</span>}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="marca" label="Marca" opcional>
              <Input id="marca" value={marca} onChange={(e) => setMarca(e.target.value)} className="h-10 bg-card" />
            </Campo>
            <Campo id="modelo" label="Modelo" opcional>
              <Input id="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} className="h-10 bg-card" />
            </Campo>
            <Campo id="serie" label="Serie" opcional>
              <Input id="serie" value={serie} onChange={(e) => setSerie(e.target.value)} className="h-10 bg-card" />
            </Campo>
            <Campo id="medidas" label="Medidas" opcional>
              <Input id="medidas" value={medidas} onChange={(e) => setMedidas(e.target.value)} placeholder="Ej.: 60 × 60 × 95 cm" className="h-10 bg-card" />
            </Campo>
            <Campo id="color" label="Color" opcional>
              <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 bg-card" />
            </Campo>
            <Campo id="estado" label="Estado de conservación" error={errores.estado}>
              <Select
                value={estado || null}
                onValueChange={(v) => {
                  setEstado((v as EstadoConservacion | null) ?? "");
                  limpiar();
                }}
                items={ESTADOS}
              >
                <SelectTrigger id="estado" className="h-10 w-full bg-card">
                  <SelectValue placeholder="Elige N, B, R o M" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <p className="text-xs text-muted-foreground">
            Si dejas vacíos marca, modelo, medidas o serie, se guardan sin dato y se muestran como «S/M» (marca, modelo,
            medidas) o «S/S» (serie); el color vacío queda en blanco.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Responsable y ubicación inicial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Campo
            id="responsable"
            label="Responsable inicial"
            opcional
            error={errores.responsable}
            ayuda="Si eliges a alguien, el bien queda EN USO con «a su cargo desde» S/F. Si no, queda SIN ASIGNAR."
          >
            <Select
              value={responsableId || SIN_RESPONSABLE}
              onValueChange={(v) => {
                setResponsableId(!v || v === SIN_RESPONSABLE ? "" : v);
                limpiar();
              }}
              items={opcionesResponsable}
            >
              <SelectTrigger id="responsable" className="h-10 w-full bg-card">
                <SelectValue />
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

          <Campo id="ubicacion" label="Ubicación inicial" opcional>
            <Input
              id="ubicacion"
              list="ubicaciones-bien"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej.: Almacén central"
              className="h-10 bg-card"
            />
            <datalist id="ubicaciones-bien">
              {ubicacionesConocidas.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Campo>

          <Campo
            id="cantidad"
            label="Cantidad"
            error={errores.cantidad}
            ayuda={`Para registrar varios bienes iguales de una vez (de 1 a ${MAX_CANTIDAD}).`}
          >
            <Input
              id="cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CANTIDAD}
              value={cantidad}
              onChange={(e) => {
                setCantidad(e.target.value);
                limpiar();
              }}
              aria-invalid={!!errores.cantidad}
              className="h-10 w-32 bg-card tabular-nums"
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Códigos que se van a generar</CardTitle>
        </CardHeader>
        <CardContent>
          {!tipo ? (
            <p className="text-[13.5px] text-muted-foreground">Elige el tipo de bien para ver los códigos.</p>
          ) : n === null ? (
            <p className="text-[13.5px] text-muted-foreground">Indica una cantidad válida (de 1 a {MAX_CANTIDAD}).</p>
          ) : !codigos ? (
            <p role="alert" className="text-[13.5px] text-[#B42318]">
              No alcanzan los correlativos de este tipo de bien.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {codigos.length === 1 ? "1 código" : `${codigos.length} códigos consecutivos`} de 12 dígitos: el código de
                catálogo ({tipo.codigo}) más el correlativo de 4 dígitos.
              </p>
              <ul aria-label="Códigos patrimoniales que se generarán" className="flex flex-wrap gap-2">
                {codigos.map((c) => (
                  <li key={c} className="rounded-md border bg-[#F9FAFB] px-2.5 py-1 text-[13px] font-medium tabular-nums">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-10 px-5">
          {n !== null && n > 1 ? `Registrar ${n} bienes` : "Registrar bien"}
        </Button>
        <Button variant="outline" className="h-10" render={<Link href="/bienes" />} nativeButton={false}>
          Volver a Bienes
        </Button>
      </div>
    </form>
  );
}
