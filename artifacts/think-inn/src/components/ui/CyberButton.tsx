import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function CyberButton({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: CyberButtonProps) {
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center font-display tracking-widest uppercase transition-all duration-200 overflow-hidden hud-clip disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(0,255,255,0.4)]": variant === "primary",
          "bg-secondary text-primary hover:bg-secondary/80 border border-primary/20 hover:border-primary/50": variant === "secondary",
          "bg-accent/10 text-accent border border-accent/50 hover:bg-accent/20 hover:shadow-[0_0_15px_rgba(200,0,255,0.4)]": variant === "accent",
          "bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/5": variant === "ghost",
          "bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20": variant === "destructive",
          "px-3 py-1.5 text-xs": size === "sm",
          "px-6 py-2.5 text-sm": size === "md",
          "px-8 py-4 text-base font-bold": size === "lg",
        },
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {variant !== "ghost" && (
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-current opacity-50" />
      )}
    </button>
  );
}
