"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../components/Navbar";
import { SCENARIOS } from "../api/lib/scenarios";

export default function Scenarios() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleScenarioClick = (scenario) => {
    router.push(scenario.route);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoaded={isLoaded} />
      <div className={`flex-1 transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="px-6 sm:px-12 lg:px-20 pt-10 sm:pt-14 pb-10 sm:pb-12">
          <div className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <h1 className="font-dmSerifDisplay text-fadedBlack text-4xl sm:text-5xl leading-[0.95]">choose your scenario</h1>
          </div>
        </div>

        <div className="px-6 sm:px-12 lg:px-20 pb-16">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.key}
                onClick={() => handleScenarioClick(scenario)}
                className="group bg-background border border-fadedBlack/10 p-5 sm:p-6 flex flex-col items-start gap-4 transition-colors duration-200 hover:bg-fadedBlack hover:border-fadedBlack"
              >
                <scenario.icon
                  size={36}
                  className="text-fadedBlack group-hover:text-background transition-colors"
                />
                <p className="font-bigShouldersDisplay text-fadedBlack text-base sm:text-lg uppercase group-hover:text-background transition-colors text-left leading-tight">
                  {scenario.label}
                </p>
                <p className="font-dmSans font-normal text-fadedBlack/70 text-xs sm:text-sm text-left group-hover:text-background/70 transition-colors leading-relaxed">
                  {scenario.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
