/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "380px",
      },
      colors: {
        // Vela palette (dark only, single gold accent)
        accent: "#F2C14E",
        "accent-soft": "#F7D27E",
        "accent-text": "#3A2D00",
        background: "#0B0A12",
        surface: "#16131F",
        "surface-2": "#1E1A2B",
        border: "#2A2540",
        muted: "#9A93B2",
        // dark-theme-safe error hue — used ONLY for genuine error states, kept
        // distinct from the single gold brand accent.
        danger: "#F2848B",
        // keep the template's `black` token but map it to the Vela background
        black: "#0B0A12",
      },
      textColor: {
        lightGray: "#F6F4FF",
        primary: "#F6F4FF",
        // template uses `secColor` for highlights / active states -> Vela gold
        secColor: "#F2C14E",
        navColor: "#9A93B2",
        muted: "#9A93B2",
        accent: "#F2C14E",
        danger: "#F2848B",
      },
      backgroundColor: {
        mainColor: "#0B0A12",
        secondaryColor: "#16131F",
        surface: "#16131F",
        accent: "#F2C14E",
        blackOverlay: "rgba(11, 10, 18, 0.6)",
      },
      borderColor: {
        DEFAULT: "#2A2540",
        accent: "#F2C14E",
      },
      boxShadow: {
        glow: "0 0 22px rgba(242, 193, 78, 0.45)",
        glowLight: "0 0 28px rgba(242, 193, 78, 0.35)",
      },
    },
    fontFamily: {
      sans: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      // remap the template's font tokens to Sora so existing classes inherit it
      nunito: ["Sora", "sans-serif"],
      roboto: ["Sora", "sans-serif"],
      robotoCondensed: ["Sora", "sans-serif"],
      display: ["Sora", "sans-serif"],
    },
  },
  plugins: [],
};
