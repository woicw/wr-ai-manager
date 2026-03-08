import { Outlet } from 'react-router';
import { useEffect } from 'react';
import { useConfigStore, useThemeStore } from './stores';
import { Sidebar } from './components/Sidebar';
import i18n from './i18n';
import { useSettingsStore } from './stores';

function App() {
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const theme = useThemeStore((state) => state.theme);
  const locale = useSettingsStore((state) => state.locale);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.5),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.32),transparent_24%)] p-3">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto rounded-[32px] border border-white/40 bg-card/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default App;
