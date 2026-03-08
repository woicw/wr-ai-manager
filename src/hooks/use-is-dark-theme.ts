import { useEffect, useState } from "react";

import { useThemeStore } from "@/stores";

export function useIsDarkTheme() {
  const theme = useThemeStore((state) => state.theme);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return theme === "dark" || (theme === "system" && systemDark);
}

