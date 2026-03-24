import React, { ReactNode } from "react";
import { Activity, Zap, ShieldAlert, Fingerprint } from "lucide-react";

export function HUDLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full bg-background text-foreground flex overflow-hidden relative">
      {/* Decorative Effects */}
      <div className="scanline" />
      <div className="vignette" />
      
      {/* Cyberpunk Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none" 
        style={{
          backgroundImage: `url('${import.meta.env.BASE_URL}images/neural-grid.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'contrast(1.5) brightness(1.5)'
        }}
      />

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 w-full h-8 border-b border-primary/20 bg-background/80 backdrop-blur-sm z-50 flex items-center px-4 justify-between text-xs font-display text-primary/70">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2"><Fingerprint size={12} className="text-primary animate-pulse" /> THINK-INN // CORE_SYS</span>
          <span className="opacity-50 hidden md:inline">V1.0.4.928</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2"><Activity size={12} className="text-accent" /> SYS: NOMINAL</span>
          <span className="flex items-center gap-2"><Zap size={12} className="text-primary" /> UPLINK: STABLE</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex w-full h-full pt-8 relative z-10">
        {children}
      </main>

      {/* Decorative Corner SVG */}
      <svg className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none z-50 opacity-30" viewBox="0 0 100 100">
        <path d="M 0,100 L 0,50 L 50,100 Z" fill="hsl(var(--primary))" opacity="0.1" />
        <path d="M 0,90 L 10,100 L 0,100 Z" fill="hsl(var(--primary))" />
        <line x1="0" y1="70" x2="30" y2="100" stroke="hsl(var(--primary))" strokeWidth="2" />
      </svg>
      <svg className="absolute top-8 right-0 w-32 h-32 pointer-events-none z-50 opacity-30" viewBox="0 0 100 100">
        <path d="M 100,0 L 50,0 L 100,50 Z" fill="hsl(var(--accent))" opacity="0.1" />
        <line x1="100" y1="30" x2="70" y2="0" stroke="hsl(var(--accent))" strokeWidth="2" />
      </svg>
    </div>
  );
}
