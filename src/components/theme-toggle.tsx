import { useThemeStore } from '../stores';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const themes = [
    { value: 'light' as const, icon: SunIcon, label: t('settings.theme.light') },
    { value: 'dark' as const, icon: MoonIcon, label: t('settings.theme.dark') },
    { value: 'system' as const, icon: ComputerDesktopIcon, label: t('settings.theme.system') },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-background/50 p-1">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            theme === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          title={label}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
