"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import Loading from "../../components/Loading";
import AuthModal from "../../components/AuthModal";
import { Navbar } from "../../components/Navbar";

export default function StreamingServicesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, refreshAuth } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectAllFree, setSelectAllFree] = useState(false);
  const [providers, setProviders] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setIsLoaded(true);
    fetchProviders();
  }, []);

  useEffect(() => {
    // Load user preferences only if authenticated
    if (isAuthenticated && !authLoading) {
      loadUserPreferences();
    }
  }, [isAuthenticated, authLoading]);

  const fetchProviders = async () => {
    try {
      setIsLoadingProviders(true);
      const response = await fetch("/api/providers");
      const data = await response.json();
      const processedProviders = data.providers.map((provider) => ({
        id: provider.provider_id,
        name: provider.provider_name,
        type: provider.type,
        logo_path: provider.logo_path,
      }));
      setProviders(processedProviders);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const response = await fetch("/api/user/streaming-services");
      if (response.ok) {
        const data = await response.json();
        const services = data.streamingServices || [];

        if (Array.isArray(services)) {
          setSelectedServices(services);
        } else {
          console.error("streamingServices is not an array:", services);
          setSelectedServices([]);
        }
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const toggleService = (serviceId) => {
    setSelectedServices((prev) => (prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]));
  };

  useEffect(() => {
    if (providers.length > 0 && selectedServices.length > 0) {
      const freeServiceIds = providers.filter((p) => p.type === "free" || p.type === "ads").map((s) => s.id);
      const allFreeSelected = freeServiceIds.length > 0 && freeServiceIds.every((id) => selectedServices.includes(id));
      setSelectAllFree(allFreeSelected);
    }
  }, [selectedServices, providers]);

  const handleSaveAndContinue = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Show auth modal instead of saving
      setShowAuthModal(true);
      return;
    }

    // User is authenticated, proceed with saving
    await savePreferences();
  };

  const savePreferences = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/user/streaming-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamingServices: selectedServices }),
      });

      if (response.ok) {
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get("returnTo") || "/";
        router.push(returnTo);
      } else {
        setSaveError("Failed to save preferences. Please try again.");
      }
    } catch (error) {
      setSaveError("An error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthSuccess = async () => {
    // Close modal
    setShowAuthModal(false);

    // Refresh auth state
    await refreshAuth();

    // Save preferences and continue
    await savePreferences();
  };

  const handleSkip = () => {
    router.push("/scenarios");
  };

  // Show loading state while checking auth or loading providers
  if (authLoading || isLoadingProviders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loading size={40} className="mx-auto mb-4" />
          <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] text-fadedBlack/70">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar isLoaded={isLoaded} currentPage="profile" />

      <div className={`transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="max-w-5xl mx-auto px-6 sm:px-12 lg:px-20 pt-12 pb-2">
          {/* ── Header ── */}
          <div className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <h1 className="font-dmSerifDisplay text-4xl sm:text-5xl text-fadedBlack leading-[0.95]">your services</h1>
            <p className="font-dmSans text-sm text-fadedBlack/70 mt-4 max-w-md leading-relaxed">
              Pick the platforms you have access to, and we&apos;ll keep recommendations to what you can actually watch tonight.
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 sm:px-12 lg:px-20 pt-8">
        {/* Paid/Subscription Services */}
        <div
          className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "300ms" }}
        >
          <h2 className="font-bigShouldersDisplay text-base uppercase tracking-[0.03em] text-fadedBlack">Subscription Services</h2>
          <p className="font-dmSans text-xs text-fadedBlack/70 mt-1 mb-6">Paid streaming platforms</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {providers
              .filter((p) => p.type === "flatrate")
              .map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div
                    key={service.id}
                    className={`flex flex-col items-center gap-3 p-4 border transition-colors ${
                      isSelected ? "bg-backgroundSecondary border-fadedBlack/40" : "bg-background border-fadedBlack/10 hover:bg-backgroundSecondary"
                    }`}
                  >
                    <span className="font-dmSans text-[10px] uppercase tracking-[0.1em] text-fadedBlack/70 text-center">{service.name}</span>
                    <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} width={200} height={96} loading="lazy" className="h-24 w-auto" />
                    </button>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <label className="flex items-center cursor-pointer gap-2">
                        <div
                          className={`w-5 h-5 border-2 border-fadedBlack/40 rounded-full flex items-center justify-center transition-all duration-200 ${
                            isSelected ? "bg-fadedBlack border-fadedBlack" : "bg-background"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 bg-background rounded-full" />}
                        </div>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} className="hidden" />
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Free Services with Ads */}
        <div
          className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "400ms" }}
        >
          <div className="flex items-center justify-between mb-6 mt-10">
            <div>
              <h2 className="font-bigShouldersDisplay text-base uppercase tracking-[0.03em] text-fadedBlack">Free Services (with ads)</h2>
              <p className="font-dmSans text-xs text-fadedBlack/70 mt-1">Ad-supported streaming platforms</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {providers
              .filter((p) => p.type === "free" || p.type === "ads")
              .map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div
                    key={service.id}
                    className={`flex flex-col items-center gap-3 p-4 border transition-colors ${
                      isSelected ? "bg-backgroundSecondary border-fadedBlack/40" : "bg-background border-fadedBlack/10 hover:bg-backgroundSecondary"
                    }`}
                  >
                    <span className="font-dmSans text-[10px] uppercase tracking-[0.1em] text-fadedBlack/70 text-center">{service.name}</span>
                    <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} width={200} height={96} loading="lazy" className="h-24 w-auto" />
                    </button>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <label className="flex items-center cursor-pointer gap-2">
                        <div
                          className={`w-5 h-5 border-2 border-fadedBlack/40 rounded-full flex items-center justify-center transition-all duration-200 ${
                            isSelected ? "bg-fadedBlack border-fadedBlack" : "bg-background"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 bg-background rounded-full" />}
                        </div>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} className="hidden" />
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Sticky Save Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-fadedBlack/10 px-6 py-4 flex flex-col items-center gap-2">
        {saveError && (
          <p className="font-dmSans text-xs text-danger text-center">{saveError}</p>
        )}
        <button
          onClick={handleSaveAndContinue}
          disabled={isSaving}
          className="w-full max-w-sm bg-fadedBlack text-background border border-fadedBlack font-dmSans text-[10px] uppercase tracking-[0.12em] py-4 hover:bg-fadedBlue hover:border-fadedBlue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : "Save & Continue"}
        </button>
      </div>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
