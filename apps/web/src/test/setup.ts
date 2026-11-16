import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("lucide-react", () => {
  const createIcon = (name: string) => {
    const Icon = (props: React.SVGProps<SVGSVGElement>) =>
      React.createElement("svg", { ...props, "data-lucide-icon": name });
    Icon.displayName = name;
    return Icon;
  };

  const iconNames = [
    "Activity",
    "AlertCircle",
    "AlertOctagon",
    "AlertTriangle",
    "ArrowLeft",
    "ArrowRight",
    "Briefcase",
    "CheckCircle2",
    "Clock",
    "Code2",
    "Database",
    "DollarSign",
    "Eye",
    "EyeOff",
    "FileCheck2",
    "FileSpreadsheet",
    "Gauge",
    "Info",
    "Landmark",
    "Layers",
    "Loader2",
    "Lock",
    "MousePointerClick",
    "Move",
    "PlusCircle",
    "Radio",
    "RefreshCw",
    "RotateCcw",
    "Save",
    "Send",
    "ServerCrash",
    "ShieldAlert",
    "ShieldCheck",
    "Sparkles",
    "Terminal",
    "Undo2",
    "User",
    "XCircle",
    "Zap",
  ];

  const exportsMap: Record<string, unknown> = { __esModule: true };
  for (const name of iconNames) {
    exportsMap[name] = createIcon(name);
  }
  return exportsMap;
});

afterEach(() => {
  cleanup();
});

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memoryStorage = new MemoryStorage();

Object.defineProperty(window, "localStorage", {
  value: memoryStorage,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: memoryStorage,
  writable: true,
  configurable: true,
});