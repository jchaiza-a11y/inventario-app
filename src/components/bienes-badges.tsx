import { Badge } from "@/components/ui/badge";
import type { Situacion } from "@/lib/patrimonio";
import { cn } from "@/lib/utils";

const estilosSituacion: Record<Situacion, { badge: string; punto: string }> = {
  "EN USO": { badge: "bg-[#ECFDF3] text-[#067647]", punto: "bg-[#12B76A]" },
  "EN REPARACION": { badge: "bg-[#FFFAEB] text-[#B54708]", punto: "bg-[#F79009]" },
  "SIN ASIGNAR": { badge: "bg-[#FEF3F2] text-[#B42318]", punto: "bg-[#F04438]" },
};

export function SituacionBadge({ situacion }: { situacion: Situacion }) {
  const e = estilosSituacion[situacion];
  return (
    <Badge variant="secondary" className={cn("h-6 gap-1.5 px-2.5", e.badge)}>
      <span className={cn("size-1.5 rounded-full", e.punto)} aria-hidden />
      {situacion}
    </Badge>
  );
}

export function CondicionBadge({ custodiaDe }: { custodiaDe: string | null }) {
  if (!custodiaDe) {
    return (
      <Badge variant="outline" className="h-6 bg-[#F2F4F7] px-2.5 text-[#475467]">
        Propio
      </Badge>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="outline" className="h-6 border-[#D9C8FA] bg-[#F4EBFF] px-2.5 text-[#6941C6]">
        Custodia
      </Badge>
      <span className="text-xs text-muted-foreground">de {custodiaDe}</span>
    </div>
  );
}
