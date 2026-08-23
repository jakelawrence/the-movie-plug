import React from "react";

// Joins the parts that exist with a faint separator — a film missing its year or
// runtime must not leave a dangling "·". Callers own gap, alignment, and type;
// this only owns the separator, so the panel and the grid cards can share it at
// different scales.
export function MetaRow({ parts, className = "" }) {
  const present = parts.filter(Boolean);
  if (present.length === 0) return null;

  return (
    <div className={`flex items-center flex-wrap ${className}`}>
      {present.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-fadedBlack/25">·</span>}
          <span>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
