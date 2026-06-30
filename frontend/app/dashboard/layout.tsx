// frontend/app/dashboard/layout.tsx — CareerOS v2.0
import type { Metadata } from "next";
import { SidebarProvider } from "@/components/dashboard/Sidebar";
import { Sidebar }         from "@/components/dashboard/Sidebar";
import { Topbar }          from "@/components/dashboard/Topbar";

export const metadata: Metadata = {
  title: "CareerOS AI — Command Centre",
  description: "CareerOS AI — the complete AI-powered job search command centre.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main
            className="flex-1 overflow-y-auto p-5 md:p-6"
            id="main-content"
            aria-label="Dashboard content"
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
