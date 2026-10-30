import { Suspense } from "react";
import { FichaAsignacion } from "@/components/ficha-asignacion";
import { personas } from "@/data/mock";

export function generateStaticParams() {
  return personas.map((p) => ({ id: p.id }));
}

async function FichaDePersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FichaAsignacion personaId={id} />;
}

export default function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando ficha…</p>}>
      <FichaDePersona params={params} />
    </Suspense>
  );
}
