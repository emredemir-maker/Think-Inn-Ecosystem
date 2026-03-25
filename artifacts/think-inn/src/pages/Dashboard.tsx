import React, { useState } from "react";
import { HUDLayout } from "@/components/layout/HUDLayout";
import { VitrinePanel } from "@/components/dashboard/VitrinePanel";
import { OrchestratorChat } from "@/components/chat/OrchestratorChat";
import { LayoutGrid, MessageSquare } from "lucide-react";

export default function Dashboard() {
  const [mobileTab, setMobileTab] = useState<"vitrine" | "chat">("vitrine");

  return (
    <HUDLayout>
      {/* ── Desktop: side-by-side (lg+) ─────────────────────────────── */}
      <div className="hidden lg:flex flex-1 overflow-hidden w-full h-full">
        <VitrinePanel />
        <OrchestratorChat />
      </div>

      {/* ── Mobile: one panel at a time (< lg) ──────────────────────── */}
      <div className="flex lg:hidden flex-col flex-1 overflow-hidden w-full h-full">
        {/* Tab toggle bar */}
        <div className="flex shrink-0 border-b border-gray-100 bg-white">
          <button
            onClick={() => setMobileTab("vitrine")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
              mobileTab === "vitrine"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <LayoutGrid size={15} />
            İnovasyon Vitrini
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
              mobileTab === "chat"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <MessageSquare size={15} />
            AI Asistan
          </button>
        </div>

        {/* Active panel */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "vitrine" ? <VitrinePanel /> : <OrchestratorChat />}
        </div>
      </div>
    </HUDLayout>
  );
}
