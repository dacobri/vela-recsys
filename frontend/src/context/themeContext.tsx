import React, { useContext, useEffect } from "react";

// Vela is dark-only. The theme is hardcoded to "Dark"; the light/dark toggle
// and the System option have been removed. This context is kept (with a minimal
// surface) so any remaining `useTheme()` consumers keep working.
const context = React.createContext({
  theme: "Dark",
});

interface Props {
  children: React.ReactNode;
}

const ThemeProvider = ({ children }: Props) => {
  useEffect(() => {
    // Force the `dark` class on <html> so Tailwind `dark:` utilities stay active.
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <context.Provider value={{ theme: "Dark" }}>{children}</context.Provider>
  );
};

export default ThemeProvider;

export const useTheme = () => {
  return useContext(context);
};
