// ── Vela backend ─────────────────────────────────────────────────────────────
// Base URL of the Vela FastAPI backend. All recommendation / arena / evaluation /
// taste / galaxy / chat calls go through src/services/velaApi.ts.
export const API_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── TMDB (browse pages) ──────────────────────────────────────────────────────
export const TMDB_API_BASE_URL: string | undefined = import.meta.env
  .VITE_TMDB_API_BASE_URL;
export const API_KEY: string | undefined = import.meta.env.VITE_API_KEY;

export const THROTTLE_DELAY = 150;
