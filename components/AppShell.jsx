"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import DynamicRenderer from "@/components/DynamicRenderer";
import FrictionDashboard from "@/components/FrictionDashboard";
import { useApplication } from "@/context/ApplicationContext";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentSection } = useApplication();

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-bold text-slate-900">AuraGen</span>
        </header>

        <main className="px-4 py-8 sm:px-8 lg:py-10">
          {currentSection === "dashboard" ? ( <Dashboard /> ) 
            : currentSection === "friction" ? (
           <FrictionDashboard />
          ) : (
            <DynamicRenderer />
          )}
          </main>
      </div>
    </div>
  );
}
