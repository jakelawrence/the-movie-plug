"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Tv, Heart, Settings, LogOut } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import Loading from "../components/Loading";

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoaded(true);
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load profile");
      }

      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      console.error("Error loading profile:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} />
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-dmSerifDisplay text-3xl text-fadedBlack leading-tight mb-6">we couldn&apos;t load your profile</h1>
          <button
            onClick={() => router.push("/")}
            className="font-dmSans text-[10px] uppercase tracking-[0.12em] text-fadedBlack bg-fadedBlack/0 border border-fadedBlack px-6 py-3.5 hover:bg-fadedBlack hover:text-background transition-colors duration-200"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { user, stats } = profileData;

  const getInitials = () => {
    if (!user) return "U";
    if (user.name) {
      const names = user.name.trim().split(" ");
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    return user.email ? user.email[0].toUpperCase() : "U";
  };

  const profileActions = [
    {
      id: "saved-movies",
      title: "Saved Movies",
      description: "View your favorite and liked movies",
      icon: Heart,
      route: "/profile/saved-movies",
      count: stats.totalSavedMovies,
    },
    {
      id: "streaming-services",
      title: "Streaming Services",
      description: "Manage your streaming platforms",
      icon: Tv,
      route: "/profile/streaming-service",
      count: stats.totalStreamingServices,
    },
    {
      id: "settings",
      title: "Account Settings",
      description: "Update your profile information",
      icon: Settings,
      route: "/profile/settings",
      disabled: true, // Coming soon
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar isLoaded={isLoaded} currentPage={"profile"} />
      <div className="max-w-4xl mx-auto px-6 sm:px-12 lg:px-20">
        {/* Title */}
        <div
          className={`flex items-end justify-between gap-6 pt-12 pb-10 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div>
            <h1 className="font-dmSerifDisplay text-4xl sm:text-5xl text-fadedBlack leading-[0.95]">profile</h1>
          </div>
          <button
            onClick={logout}
            className="flex-shrink-0 inline-flex items-center gap-2 font-dmSans text-[10px] uppercase tracking-[0.12em] text-fadedBlack/70 border border-fadedBlack/20 px-4 py-2.5 hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors duration-200"
          >
            <LogOut size={14} strokeWidth={2} />
            Sign Out
          </button>
        </div>

        {/* Identity */}
        <div
          className={`flex items-center gap-5 pb-10 border-b border-fadedBlack/10 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="w-20 h-20 rounded-full bg-fadedBlack border border-fadedBlack/15 flex items-center justify-center text-background font-dmSerifDisplay text-2xl flex-shrink-0">
            {getInitials()}
          </div>
          <div className="min-w-0">
            <h2 className="font-dmSerifDisplay text-2xl sm:text-3xl text-fadedBlack leading-tight truncate">{user.username || "User"}</h2>
            <p className="font-dmSans text-sm text-fadedBlack/70 mt-1 break-all">{user.email}</p>
          </div>
        </div>

        {/* User Details */}
        <dl
          className={`grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 py-10 border-b border-fadedBlack/10 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          {[
            { icon: User, label: "Username", value: user.username || "Not set" },
            { icon: Mail, label: "Email", value: user.email, wrap: true },
            { icon: Calendar, label: "Member Since", value: stats.memberSince },
            { icon: Tv, label: "Streaming Services", value: `${stats.totalStreamingServices} selected` },
          ].map(({ icon: Icon, label, value, wrap }) => (
            <div key={label} className="flex items-start gap-3.5">
              <Icon size={18} strokeWidth={1.75} className="flex-shrink-0 text-fadedBlack/40 mt-1" />
              <div className="min-w-0">
                <dt className="font-dmSans text-[9px] uppercase tracking-[0.22em] text-fadedBlack/70 mb-1.5">{label}</dt>
                <dd className={`font-dmSans text-base text-fadedBlack ${wrap ? "break-all" : ""}`}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {/* Actions */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-10 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          {profileActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => !action.disabled && router.push(action.route)}
                disabled={action.disabled}
                className={`bg-background border border-fadedBlack/10 p-5 text-left min-h-[150px] flex flex-col gap-2.5 transition-colors duration-200 group relative ${
                  action.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-fadedBlack hover:text-background"
                }`}
              >
                <Icon className="text-fadedBlack group-hover:text-background transition-colors" size={28} strokeWidth={1.75} />
                <h3 className="font-bigShouldersDisplay text-sm uppercase tracking-[0.03em] leading-tight text-fadedBlack group-hover:text-background transition-colors">
                  {action.title}
                </h3>
                <p className="font-dmSans text-xs text-fadedBlack/70 group-hover:text-background/70 transition-colors">{action.description}</p>

                {action.disabled && (
                  <p className="font-dmSans text-[9px] uppercase tracking-[0.18em] text-fadedBlack/70 mt-auto">Coming Soon</p>
                )}

                {/* Count */}
                {action.count !== undefined && !action.disabled && (
                  <span className="absolute top-4 right-4 font-dmSans text-[10px] tabular-nums text-fadedBlack/45 group-hover:text-background/70 transition-colors">
                    {action.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
