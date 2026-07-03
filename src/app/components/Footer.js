"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";

export default function Footer() {
  const router = useRouter();
  const [hoveredLink, setHoveredLink] = useState(null);
  const { user, isAuthenticated, logout } = useAuth();

  const NAV_LINKS = [
    { label: "Home", href: "/" },
    { label: "Search", href: "/search" },
    { label: "Saved Movies", href: "/profile/saved-movies" },
    ...(!isAuthenticated ? [{ label: "Sign In/Up", href: "/login" }] : []),
  ];

  return (
    <footer className="bg-background border-t border-fadedBlack/15 w-full">
      {/* Top strip — decorative ticker */}
      <div className="overflow-hidden border-b border-fadedBlack/10">
        <div className="flex animate-marquee whitespace-nowrap will-change-transform">
          {Array(12)
            .fill(null)
            .map((_, i) => (
              <span
                key={i}
                className="inline-block font-bigShouldersDisplay text-fadedBlack text-[10px] uppercase tracking-[0.1em] px-8 py-2 opacity-30"
              >
                &nbsp;★&nbsp; find your next favorite film &nbsp;★&nbsp;
              </span>
            ))}
        </div>
      </div>

      {/* Main footer body */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-fadedBlack/10">
        {/* Col 1 — Navigation */}
        <div className="border-b md:border-b-0 md:border-r border-fadedBlack/10 p-8">
          <p className="font-dmSans text-fadedBlack/70 text-[9px] uppercase tracking-[0.22em] mb-6">site map</p>
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.label)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="group flex items-center gap-3 py-2 border-b border-fadedBlack/10 last:border-0"
                >
                  {/* Arrow indicator */}
                  <span
                    className={`text-fadedBlack text-sm transition-all duration-150 ${
                      hoveredLink === link.label ? "opacity-100 translate-x-1" : "opacity-0 -translate-x-1"
                    }`}
                  >
                    →
                  </span>
                  <span
                    className={`font-dmSans text-xs uppercase tracking-[0.15em] transition-colors duration-150 ${
                      hoveredLink === link.label ? "text-fadedBlue" : "text-fadedBlack/70"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — CTA + Social */}
        <div className="p-8 flex flex-col justify-between gap-8">
          {/* CTA block */}
          <div>
            <p className="font-dmSans text-fadedBlack/70 text-[9px] uppercase tracking-[0.22em] mb-4">Get Started</p>
            <p className="font-dmSerifDisplay text-fadedBlack text-2xl leading-snug mb-6">Find something to watch tonight.</p>
            <button
              onClick={() => router.push("/search")}
              className="w-full bg-fadedBlack text-background border border-fadedBlack py-3.5 px-6 font-dmSans text-[10px] uppercase tracking-[0.12em] hover:bg-fadedBlue hover:border-fadedBlue transition-colors duration-150"
            >
              Start Exploring →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-8 py-4 gap-2">
        <p className="font-dmSans text-fadedBlack/70 text-[10px] uppercase tracking-[0.18em]">© {new Date().getFullYear()} you should watch.</p>
        <p className="font-dmSans text-fadedBlack/70 text-[10px] uppercase tracking-[0.18em]">All rights reserved.</p>
        <div className="flex gap-6">
          {["Privacy Policy", "Terms of Use"].map((item) => (
            <Link
              key={item}
              href="#"
              className="font-dmSans text-fadedBlack/70 text-[10px] uppercase tracking-[0.18em] hover:text-fadedBlue transition-colors duration-150"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
