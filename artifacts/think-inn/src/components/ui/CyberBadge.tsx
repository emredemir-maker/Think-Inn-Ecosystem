import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CyberBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "cyan" | "purple" | "green" | "red" | "outline";
}

export function CyberBadge({
  className,
  variant = "cyan",
  children,
  ...props
}: CyberBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-display uppercase tracking-wider border hud-clip",
        {
          "bg-primary/10 text-primary border-primary/50 shadow-[0_0_5px_rgba(0,255,255,0.2)]": variant === "cyan",
          "bg-accent/10 text-accent border-accent/50 shadow-[0_0_5px_rgba(200,0,255,0.2)]": variant === "purple",
          "bg-green-500/10 text-green-400 border-green-500/50 shadow-[0_0_5px_rgba(0,255,100,0.2)]": variant === "green",
          "bg-destructive/10 text-destructive border-destructive/50 shadow-[0_0_5px_rgba(255,0,0,0.2)]": variant === "red",
          "bg-transparent text-muted-foreground border-border": variant === "outline",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
