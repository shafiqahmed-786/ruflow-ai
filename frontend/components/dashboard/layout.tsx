// frontend/app/dashboard/layout.tsx
// Server Component — layout only. No client directive in this file.
// SidebarProvider (client) wraps children so this file preserves RSC benefits.

import type { Metadata } from "next";
import { SidebarProvider } from "@/components/dashboard/Sidebar";
import { Sidebar }         from "@/components/dashboard/Sidebar";
import { Topbar }          from "@/components/dashboard/Topbar";

export const metadata: Metadata = {
  title: "Dashboard · RuFlow",
  description: "RuFlow AI pipeline dashboard — manage applications, run agents, review ATS scores.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // SidebarProvider is a client component — wraps the shell here so
    // both Sidebar and Topbar can share isOpen state without prop drilling.
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Persistent sidebar (desktop) + mobile drawer */}
        <Sidebar />

        {/* Main content area */}
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