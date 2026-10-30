import { Suspense } from "react";
import { ActaMovimiento } from "@/components/acta-movimiento";
import { movimientos } from "@/data/mock";
import { claveActa } from "@/lib/movimientos";

export function generateStaticParams() {
  // Las actas del mock se prerenderizan; las nuevas se resuelven al abrirlas.
  const vistas = new Map(movimientos.map((m) => [claveActa(m.acta), m.acta]));
  return Array.from(vistas.values()).map((acta) => ({ acta }));
}

async function ActaDeParametro({ params }: { params: Promise<{ acta: string }> }) {
  const { acta } = await params;
  let numero = acta;
  try {
    numero = decodeURIComponent(acta);
  } catch {
    // Si no se puede decodificar se usa tal cual.
  }
  return <ActaMovimiento numero={numero} />;
}

export default function ActaPage({ params }: { params: Promise<{ acta: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando acta…</p>}>
      <ActaDeParametro params={params} />
    </Suspense>
  );
}
