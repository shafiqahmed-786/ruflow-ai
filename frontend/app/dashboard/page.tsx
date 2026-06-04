// frontend/app/dashboard/page.tsx

import { WelcomePanel } from "@/components/dashboard/WelcomePanel";
import { PipelineStatus } from "@/components/dashboard/PipelineStatus";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SystemStatus } from "@/components/dashboard/SystemStatus";

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <WelcomePanel />

      <PipelineStatus />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <RecentApplications />

        <SystemStatus />
      </div>

      <QuickActions />
    </main>
  );
}