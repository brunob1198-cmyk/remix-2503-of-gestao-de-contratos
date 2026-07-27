import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MedicoesSidebar } from "@/components/medicoes/Sidebar";
import { Outlet } from "react-router-dom";
import { LogoWithUpload } from "@/components/LogoUploader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";

export default function MedicoesLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <MedicoesSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 sm:h-16 border-b flex items-center justify-between px-2 sm:px-4 bg-background gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger />
              <LogoWithUpload className="h-8 sm:h-12 shrink-0" />
              <h1 className="font-semibold text-base sm:text-lg hidden lg:block truncate">Gestão de Contratos</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <NotificationsDropdown />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 bg-muted/30 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
