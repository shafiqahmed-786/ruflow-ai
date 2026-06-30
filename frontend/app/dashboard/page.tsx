// frontend/app/dashboard/page.tsx — CareerOS v2.0 Overview
import { WelcomePanel }       from "@/components/dashboard/WelcomePanel";
import { PipelineStatus }     from "@/components/dashboard/PipelineStatus";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { QuickActions }       from "@/components/dashboard/QuickActions";
import { SystemStatus }       from "@/components/dashboard/SystemStatus";
import { ApplicationCalendar } from "@/components/dashboard/ApplicationCalendar";
import { CareerProgress }     from "@/components/dashboard/CareerProgress";
import { AgentActivityFeed }  from "@/components/dashboard/AgentActivityFeed";

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <WelcomePanel />

      <PipelineStatus />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <RecentApplications />
        <SystemStatus />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.6fr_1fr_0.6fr]">
        <CareerProgress />
        <ApplicationCalendar />
        <AgentActivityFeed />
      </div>

      <QuickActions />
    </main>
  );
}
