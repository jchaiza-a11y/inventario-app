"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark, LayoutDashboard, Package, Users, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Resumen", icon: LayoutDashboard, pronto: false },
  { href: "/bienes", label: "Bienes", icon: Package, pronto: false },
  { href: "/personas", label: "Personas", icon: Users, pronto: false },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight, pronto: false },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Landmark className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Control Patrimonial</p>
          <p className="text-xs text-muted-foreground">Entidad Pública</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3" aria-label="Principal">
        {items.map(({ href, label, icon: Icon, pronto }) => {
          const activo = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const base =
            "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors";

          if (pronto) {
            return (
              <span
                key={href}
                aria-disabled="true"
                className={cn(base, "cursor-not-allowed text-muted-foreground/80")}
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                <Badge variant="secondary" className="h-5 text-[11px] font-normal text-muted-foreground">
                  Próximamente
                </Badge>
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                base,
                activo
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-foreground hover:bg-black/5",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
