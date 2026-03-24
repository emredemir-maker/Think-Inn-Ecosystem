import React, { ReactNode } from "react";
import { Activity, Zap, Fingerprint, Cpu } from "lucide-react";
import { motion } from "framer-motion";

export function HUDLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full bg-[#f4f6fb] text-foreground flex flex-col overflow-hidden">
      <header className="h-14 border-b border-indigo-100/60 bg-white/80 backdrop-blur-md flex items-center px-6 justify-between shrink-0 z-10 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/30 via-white/0 to-purple-50/20 pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-lg blur-md opacity-30" />
            <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Fingerprint size={18} />
            </div>
          </div>
          <div>
            <span className="font-bold text-lg text-[#1a1a2e] tracking-tight">Think-Inn</span>
            <span className="ml-2 text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">Beta</span>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm relative">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Cpu size={13} className="text-indigo-400" />
            <span className="text-gray-400">Gemini 2.5</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <motion.div
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1.5 text-xs"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-green-600 font-medium">Sistem Aktif</span>
          </motion.div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Zap size={13} className="text-amber-400" />
            <span>Çevrimiçi</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex w-full h-full relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
