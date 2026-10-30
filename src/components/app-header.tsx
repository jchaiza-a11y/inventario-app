import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SeccionActual } from "@/components/seccion-actual";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4 md:px-6 print:hidden">
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú" />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 bg-sidebar p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navegación principal</SheetDescription>
          <AppSidebar />
        </SheetContent>
      </Sheet>

      <Separator orientation="vertical" className="h-5 md:hidden" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>
              <SeccionActual />
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <Avatar>
          <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
            US
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
