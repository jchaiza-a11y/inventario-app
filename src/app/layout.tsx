import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { PatrimonioProvider } from "@/components/patrimonio-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Control Patrimonial",
  description: "Sistema de Control Patrimonial: bienes, responsables y movimientos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        <TooltipProvider>
          <PatrimonioProvider>
            <div className="flex min-h-screen">
              <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
                <div className="sticky top-0 h-screen">
                  <AppSidebar />
                </div>
              </aside>
              <div className="flex min-w-0 flex-1 flex-col">
                <AppHeader />
                <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">
                  {children}
                </main>
              </div>
            </div>
          </PatrimonioProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
