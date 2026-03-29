import React, { useState } from "react";
import { VitrinePanel } from "@/components/dashboard/VitrinePanel";
import { OrchestratorChat } from "@/components/chat/OrchestratorChat";
import { LayoutGrid, MessageSquare } from "lucide-react";

export default function Dashboard() {
  const [mobileTab, setMobileTab] = useState<"vitrine" | "chat">("vitrine");

  return (
    <>
      {/* ── Desktop: side-by-side (lg+) ─────────────────────────────── */}
      <div className="hidden lg:flex flex-1 overflow-hidden w-full h-full">
        <VitrinePanel />
        <OrchestratorChat />
      </div>

      {/* ── Mobile: one panel at a time (< lg) ──────────────────────── */}
      <div className="flex lg:hidden flex-col flex-1 overflow-hidden w-full h-full">
        <div
          className="flex shrink-0"
          style={{ borderBottom: "1px solid rgba(99,102,241,0.15)", background: "rgba(6,11,24,0.8)" }}
        >
          <button
            onClick={() => setMobileTab("vitrine")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
              mobileTab === "vitrine" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-500"
            }`}
          >
            <LayoutGrid size={15} /> İnovasyon Vitrini
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
              mobileTab === "chat" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-500"
            }`}
          >
            <MessageSquare size={15} /> AI Asistan
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileTab === "vitrine" ? <VitrinePanel /> : <OrchestratorChat />}
        </div>
      </div>
    </>
  );
}
