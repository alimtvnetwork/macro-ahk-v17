/**
 * Theme Provider — Dark-only mode.
 *
 * The extension always uses the dark theme. No toggle, no persistence needed.
 * The `dark` class is set in HTML files and reinforced here on mount.
 */
import { createContext, useContext, useEffect } from "react";

type Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark" });

/** Ensures the `dark` class is on <html> at all times. */
function enforceDarkClass() {
  const root = document.documentElement;
  if (!root.classList.contains("dark")) {
    root.classList.add("dark");
  }
  root.classList.remove("light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    enforceDarkClass();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
