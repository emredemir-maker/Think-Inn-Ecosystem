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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "bg-blue-50 text-blue-700": variant === "cyan",
          "bg-indigo-50 text-indigo-700": variant === "purple",
          "bg-green-50 text-green-700": variant === "green",
          "bg-red-50 text-red-700": variant === "red",
          "border border-border text-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
