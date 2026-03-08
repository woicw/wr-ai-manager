import {
  CpuChipIcon,
  HomeIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { NavLink, Outlet } from "react-router";

import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/settings", label: "Settings", icon: Cog6ToothIcon },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="border-b border-zinc-200 bg-white md:w-72 md:border-r md:border-b-0">
          <div className="border-b border-zinc-200 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
              WR AI Manager
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span
                aria-label="WR AI Manager brand"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-50 shadow-sm"
                role="img"
              >
                <SparklesIcon className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Tauri Starter
                </h1>
                <p className="text-sm text-zinc-500">Heroicons-powered shell</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              React, Zustand, Tailwind CSS, Radix UI and React Router.
            </p>
          </div>

          <nav className="flex gap-2 p-4 md:flex-col">
            {navItems.map(({ end, icon: Icon, label, to }) => (
              <NavLink
                key={to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-zinc-900 text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )
                }
                end={end}
                to={to}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-10">
          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500">
            <CpuChipIcon aria-hidden="true" className="h-4 w-4" />
            <span>Streamlined dashboard foundation</span>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
