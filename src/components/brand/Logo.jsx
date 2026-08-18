import React from "react";
import { cn } from "@/lib/utils";

const LOGOS = {
  horizontal: "https://media.base44.com/images/public/6a81d38c272422709e43236f/534ee6237_ClinicalSOS-final-Horiz.jpg",
  horizontalDark: "https://media.base44.com/images/public/6a81d38c272422709e43236f/18e9988d9_ClinicalSOS-final-Horiz.png",
  vertical: "https://media.base44.com/images/public/6a81d38c272422709e43236f/c6e1187c7_ClinicalSOS-final-Vert.jpg",
  verticalDark: "https://media.base44.com/images/public/6a81d38c272422709e43236f/189258794_ClinicalSOS-final-Vert-cut-Reverse.png",
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