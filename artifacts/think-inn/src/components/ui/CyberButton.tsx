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
        "inline-flex items-center justify-center rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none",
        {
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm": variant === "primary",
          "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
          "bg-[#f3f4f6] text-[#1a1a2e] hover:bg-[#e5e7eb]": variant === "accent",
          "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm": variant === "destructive",
          "h-8 px-4 text-xs": size === "sm",
          "h-10 px-6 py-2 text-sm": size === "md",
          "h-12 px-8 text-base": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
