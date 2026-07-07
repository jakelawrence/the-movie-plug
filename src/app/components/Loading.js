import React from "react";
import Image from "next/image";

// Black eye by default (for light surfaces). Pass `variant="light"` to use the
// white eye on dark backgrounds so the spinner stays visible.
export default function Loading({ size = 50, variant = "dark", className = "" }) {
  const src = variant === "light" ? "/images/eye-white.png" : "/images/eye-black.png";

  return (
    <Image
      src={src}
      alt="Loading"
      role="status"
      aria-label="Loading"
      width={size}
      height={size}
      priority
      className={`animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
