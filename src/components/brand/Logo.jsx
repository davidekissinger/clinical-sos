import React from "react";
import { cn } from "@/lib/utils";

const LOGOS = {
  horizontal: "/assets/brand/clinical-sos-horizontal.jpg",
  horizontalDark: "/assets/brand/clinical-sos-horizontal-dark.png",
  vertical: "/assets/brand/clinical-sos-vertical.jpg",
  verticalDark: "/assets/brand/clinical-sos-vertical-dark.png",
};

export default function Logo({ variant = "horizontal", className, onDark = false }) {
  const src = onDark
    ? variant === "vertical"
      ? LOGOS.verticalDark
      : LOGOS.horizontalDark
    : variant === "vertical"
      ? LOGOS.vertical
      : LOGOS.horizontal;

  return (
    <img
      src={src}
      alt="Clinical SOS"
      className={cn(
        "object-contain select-none",
        variant === "vertical" ? "h-12" : "h-8",
        className
      )}
    />
  );
}
