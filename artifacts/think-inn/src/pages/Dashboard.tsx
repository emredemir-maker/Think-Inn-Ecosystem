import React from "react";
import { HUDLayout } from "@/components/layout/HUDLayout";
import { VitrinePanel } from "@/components/dashboard/VitrinePanel";
import { OrchestratorChat } from "@/components/chat/OrchestratorChat";

export default function Dashboard() {
  return (
    <HUDLayout>
      <VitrinePanel />
      <OrchestratorChat />
    </HUDLayout>
  );
}
