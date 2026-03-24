import React, { ReactNode } from "react";
import { Activity, Zap, Fingerprint } from "lucide-react";

export function HUDLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full bg-[#f8f9fa] text-foreground flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-border bg-white flex items-center px-6 justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-md text-primary">
            <Fingerprint size={20} />
          </div>
          <span className="font-semibold text-lg text-[#1a1a2e] tracking-tight">Think-Inn</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-[#6b7280]">
          <span className="flex items-center gap-1.5"><Activity size={14} className="text-green-500" /> Sistem: Aktif</span>
          <span className="flex items-center gap-1.5"><Zap size={14} className="text-primary" /> Çevrimiçi</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex w-full h-full relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
