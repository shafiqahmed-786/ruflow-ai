// frontend/app/page.tsx

import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AgentEcosystem } from "@/components/landing/AgentEcosystem";
import { LivePipeline } from "@/components/landing/LivePipeline";
import { TemplateShowcase } from "@/components/landing/TemplateShowcase";
import { WhyRuFlow } from "@/components/landing/WhyRuFlow";
import { StatsSection } from "@/components/landing/StatsSection";
import { Testimonials } from "@/components/landing/Testimonials";
import { InsightsSection } from "@/components/landing/InsightsSection";
import { CTAFooter } from "@/components/landing/CTAFooter";
import { Footer } from "@/components/landing/Footer";

import {
  TransitionProvider,
} from "@/components/dashboard/TransitionOverlay";

export default function HomePage() {
  return (
    <TransitionProvider>
      <main className="min-h-screen bg-background overflow-x-hidden">
        <Navigation />

        <HeroSection />

        <HowItWorks />

        <AgentEcosystem />

        <LivePipeline />

        <TemplateShowcase />

        <WhyRuFlow />

        <StatsSection />

        <Testimonials />

        <InsightsSection />

        <CTAFooter />

        <Footer />
      </main>
    </TransitionProvider>
  );
}