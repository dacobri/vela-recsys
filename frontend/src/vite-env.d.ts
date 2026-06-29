/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Vela FastAPI backend base URL (default http://localhost:8000). */
  readonly VITE_API_URL?: string;
  /** TMDB API base URL for the template browse pages. */
  readonly VITE_TMDB_API_BASE_URL?: string;
  /** TMDB v3 API key (browse pages). */
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
