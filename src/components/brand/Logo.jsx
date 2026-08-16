import React from "react";
import { cn } from "@/lib/utils";

// Text-based logo honoring the Clinical SOS identity:
// light lavender "CLINICAL" + darker purple "SOS" with integrated medical cross.
// Uses the described brand palette; no distortion/effects applied.
export default function Logo({ variant = "horizontal", className, onDark = false }) {
  if (variant === "vertical") {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        <WordMark onDark={onDark} />
      </div>
    );
  }
  return <WordMark className={className} onDark={onDark} />;
}

function WordMark({ className, onDark }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 select-none", className)}>
      <span className={cn("font-heading font-extrabold tracking-tight text-[1.15rem] leading-none",
        onDark ? "text-[hsl(258_70%_92%)]" : "text-[hsl(262_45%_45%)]")}>
        CLINICAL
      </span>
      <span className="relative inline-flex items-center justify-center">
        <span className={cn("font-heading font-extrabold tracking-tight text-[1.15rem] leading-none",
          onDark ? "text-white" : "text-[hsl(262_58%_34%)]")}>
          SOS
        </span>
        <span className={cn("absolute -right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-[2px]",
          onDark ? "bg-[hsl(258_70%_92%)]" : "bg-[hsl(262_58%_44%)]")}>
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <span className="absolute h-[1.5px] w-[7px] bg-white rounded-full" />
            <span className="absolute h-[7px] w-[1.5px] bg-white rounded-full" />
          </span>
        </span>
      </span>
    </span>
  );
}