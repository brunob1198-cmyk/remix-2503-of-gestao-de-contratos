import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MedicoesSidebar } from "@/components/medicoes/Sidebar";
import { Outlet } from "react-router-dom";
import { LogoWithUpload } from "@/components/LogoUploader";

export default function MedicoesLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <MedicoesSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b flex items-center justify-between px-4 bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <LogoWithUpload className="h-12" />
              <h1 className="font-semibold text-lg hidden md:block">Gestão de Contratos</h1>
            </div>
          </header>
          <main className="flex-1 p-6 bg-muted/30 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
