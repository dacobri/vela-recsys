/**
 * Vela backend API client.
 *
 * A small, typed `fetch` wrapper around the Vela FastAPI backend. Every function
 * returns a typed result and throws a `VelaApiError` on a non-2xx response or a
 * network failure, so callers can `try/catch` and render a tasteful empty state.
 *
 * Base URL comes from `VITE_API_URL` (see src/utils/config.ts), default
 * http://localhost:8000.
 */
import { API_URL } from "@/utils/config";
import type { IMovie } from "@/types";

// ── Domain types ─────────────────────────────────────────────────────────────

/** Recommendation methods supported by the backend. */
export type RecMethod =
  | "popularity"
  | "content"
  | "usercf"
  | "itemcf"
  | "mf"
  | "semantic"
  | "cluster"
  | "hybrid"
  | "llm_rerank";

export const REC_METHODS: RecMethod[] = [
  "popularity",
  "content",
  "usercf",
  "itemcf",
  "mf",
  "semantic",
  "cluster",
  "hybrid",
  "llm_rerank",
];

/** Human-friendly labels + one-line descriptions for each method. */
export const METHOD_META: Record<
  RecMethod,
  { label: string; blurb: string }
> = {
  popularity: {
    label: "Popularity",
    blurb: "Damped-mean popular picks — the non-personalized baseline.",
  },
  content: {
    label: "Content",
    blurb: "TF-IDF over genres & metadata; similar to what you like.",
  },
  usercf: {
    label: "User CF",
    blurb: "Collaborative filtering over users with similar taste.",
  },
  itemcf: {
    label: "Item CF",
    blurb: "Collaborative filtering over co-rated items.",
  },
  mf: {
    label: "Matrix Factorization",
    blurb: "Latent-factor model learned from the ratings matrix.",
  },
  semantic: {
    label: "Semantic",
    blurb: "Sentence-transformer embeddings + FAISS nearest neighbours.",
  },
  cluster: {
    label: "Cluster",
    blurb: "Leiden catalog clusters — your neighbourhood of the galaxy.",
  },
  hybrid: {
    label: "Hybrid",
    blurb: "Retrieval → rank blend of the components above.",
  },
  llm_rerank: {
    label: "LLM Re-rank",
    blurb: "Claude re-ranks & explains the hybrid shortlist.",
  },
};

/** A movie as returned by the Vela backend. */
export interface VelaMovie {
  id: number;
  title: string;
  year: number | null;
  genres: string[];
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  /** ranking score for this movie under the chosen method (0..1-ish). */
  score?: number;
  /** short natural-language explanation (LLM re-rank / hybrid). */
  reason?: string;
}

export interface VelaUser {
  id: number;
  /** optional display label (e.g. "User 42 · 318 ratings"). */
  label?: string;
  n_ratings?: number;
  top_genres?: string[];
}

export interface UsersResponse {
  users: VelaUser[];
  total?: number;
}

export interface RecommendResponse {
  user_id: number;
  method: RecMethod;
  k: number;
  items: VelaMovie[];
}

export interface ArenaColumn {
  method: RecMethod;
  items: VelaMovie[];
}

export interface ArenaResponse {
  user_id: number;
  k: number;
  columns: ArenaColumn[];
}

/** Metric values for a single method. Keys are metric ids. */
export interface EvaluationRow {
  method: RecMethod;
  metrics: Record<string, number>;
}

export interface EvaluationResponse {
  k: number;
  metrics: string[]; // ordered metric ids, e.g. ["precision", "recall", ...]
  rows: EvaluationRow[];
}

export interface GenreWeight {
  genre: string;
  weight: number;
}

export interface TasteResponse {
  user_id: number;
  summary: string;
  genres: GenreWeight[];
  top_movies: VelaMovie[];
  n_ratings?: number;
}

export interface GalaxyPoint {
  id: number;
  title: string;
  x: number;
  y: number;
  cluster: number;
  genres?: string[];
  poster_url?: string | null;
}

export interface GalaxyResponse {
  n_clusters: number;
  cluster_labels?: Record<string, string>;
  points: GalaxyPoint[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  movies?: VelaMovie[];
}

// ── Error type ───────────────────────────────────────────────────────────────

export class VelaApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "VelaApiError";
    this.status = status;
    this.body = body;
  }
}

// ── Core request helper ──────────────────────────────────────────────────────

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {}
): Promise<T> {
  const url = `${API_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network error / backend not running / CORS.
    throw new VelaApiError(
      err instanceof Error && err.name === "AbortError"
        ? "Request cancelled."
        : "Could not reach the Vela backend. Is it running?",
      0,
      err
    );
  }

  if (!res.ok) {
    let parsed: unknown;
    let message = `Request failed (${res.status})`;
    try {
      parsed = await res.json();
      if (
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed &&
        typeof (parsed as { detail: unknown }).detail === "string"
      ) {
        message = (parsed as { detail: string }).detail;
      }
    } catch {
      /* response had no JSON body */
    }
    throw new VelaApiError(message, res.status, parsed);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /users — list demo users. */
export function getUsers(
  limit?: number,
  offset?: number,
  signal?: AbortSignal
): Promise<UsersResponse> {
  return request<UsersResponse>(`/users${qs({ limit, offset })}`, { signal });
}

/** GET /movies/{id} — one movie. */
export function getMovie(id: number, signal?: AbortSignal): Promise<VelaMovie> {
  return request<VelaMovie>(`/movies/${id}`, { signal });
}

/** GET /recommend?user_id&method&k — Top-K recommendations for a user. */
export function getRecommendations(
  userId: number,
  method: RecMethod,
  k = 10,
  signal?: AbortSignal
): Promise<RecommendResponse> {
  return request<RecommendResponse>(
    `/recommend${qs({ user_id: userId, method, k })}`,
    { signal }
  );
}

/** POST /arena — compare several methods for one user, side by side. */
export function compareMethods(
  userId: number,
  methods: RecMethod[],
  k = 10,
  signal?: AbortSignal
): Promise<ArenaResponse> {
  return request<ArenaResponse>(`/arena`, {
    method: "POST",
    body: { user_id: userId, methods, k },
    signal,
  });
}

/** GET /evaluate?methods&k — offline metrics table for a set of methods. */
export function getEvaluation(
  methods: RecMethod[],
  k = 10,
  signal?: AbortSignal
): Promise<EvaluationResponse> {
  return request<EvaluationResponse>(
    `/evaluate${qs({ methods: methods.join(","), k })}`,
    { signal }
  );
}

/** GET /taste/{user_id} — taste DNA (genre weights + summary + top movies). */
export function getTaste(
  userId: number,
  signal?: AbortSignal
): Promise<TasteResponse> {
  return request<TasteResponse>(`/taste/${userId}`, { signal });
}

/** GET /galaxy?n_clusters — 2D projection of the catalog colored by cluster. */
export function getGalaxy(
  nClusters?: number,
  signal?: AbortSignal
): Promise<GalaxyResponse> {
  return request<GalaxyResponse>(`/galaxy${qs({ n_clusters: nClusters })}`, {
    signal,
  });
}

/** POST /chat — conversational recommendations. */
export function chat(
  userId: number,
  message: string,
  history: ChatMessage[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  return request<ChatResponse>(`/chat`, {
    method: "POST",
    body: { user_id: userId, message, history },
    signal,
  });
}

// ── Adapter: VelaMovie -> IMovie (template components) ────────────────────────

/**
 * Adapt a backend `VelaMovie` into the `IMovie` shape the template's
 * MovieCard / Poster / MoviesSlides / Hero components expect. Full
 * `poster_url`/`backdrop_url` are preserved (the `imageUrl` helper passes full
 * URLs through and prefixes bare TMDB paths).
 */
export function toIMovie(movie: VelaMovie): IMovie {
  return {
    id: String(movie.id),
    poster_path: movie.poster_url ?? "",
    backdrop_path: movie.backdrop_url ?? "",
    original_title: movie.title,
    name: movie.title,
    overview: movie.overview ?? "",
    score: movie.score,
    reason: movie.reason,
  };
}

export function toIMovies(movies: VelaMovie[]): IMovie[] {
  return movies.map(toIMovie);
}
