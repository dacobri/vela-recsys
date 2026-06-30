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
  | "damped_mean"
  | "content"
  | "usercf"
  | "itemcf"
  | "mf"
  | "als"
  | "semantic"
  | "hybrid"
  | "llm_rerank";

/**
 * All methods, in the order the backend exposes them via `GET /health`. This is
 * the canonical list the Lab "Recommend" method dropdown iterates over.
 */
export const REC_METHODS: RecMethod[] = [
  "popularity",
  "damped_mean",
  "content",
  "itemcf",
  "usercf",
  "mf",
  "als",
  "semantic",
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
    blurb: "Most-rated popular picks — the non-personalized baseline.",
  },
  damped_mean: {
    label: "Damped Mean",
    blurb: "Bayesian-shrunk average rating — popularity with confidence.",
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
    blurb: "Latent-factor model (biased SGD) learned from the ratings matrix.",
  },
  als: {
    label: "ALS",
    blurb: "Alternating least squares — implicit-feedback matrix factorization.",
  },
  semantic: {
    label: "Semantic",
    blurb: "Sentence-transformer embeddings + FAISS nearest neighbours.",
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

// ── Consumer layer (localStorage profile, no backend auth) ───────────────────

/** GET /popular — a flat list of recognizable popular titles. */
export interface PopularResponse {
  items: VelaMovie[];
}

/** GET /movies/{id}/similar — "more like this" for a movie. */
export interface SimilarResponse {
  id: number;
  items: VelaMovie[];
}

/** A single labelled, Netflix-style row in the "For You" home feed. */
export interface ForYouRow {
  title: string;
  items: VelaMovie[];
}

/** POST /session/foryou & GET /foryou/{user_id} — labelled rows feed. */
export interface ForYouResponse {
  rows: ForYouRow[];
}

/** A heart-rated movie in the consumer profile sent to session endpoints. */
export interface SessionRating {
  id: number;
  rating: number;
}

/** POST /session/recommend — Top-K for an anonymous, localStorage profile. */
export interface SessionRecommendResponse {
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
    // Re-throw aborts unchanged so callers can detect them via `err.name ===
    // "AbortError"` (effect cleanup / StrictMode double-invoke shouldn't surface
    // as an error state).
    if (err instanceof Error && err.name === "AbortError") throw err;
    // Network error / backend not running / CORS.
    throw new VelaApiError(
      "Could not reach the Vela backend. Is it running?",
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

/** GET /movies/{id}/similar?k — "more like this" rail for the detail page. */
export function getSimilar(
  id: number,
  k = 14,
  signal?: AbortSignal
): Promise<SimilarResponse> {
  return request<SimilarResponse>(`/movies/${id}/similar${qs({ k })}`, {
    signal,
  });
}

/** GET /popular?k — recognizable popular titles (onboarding grid + trending). */
export function getPopular(
  k = 40,
  signal?: AbortSignal
): Promise<PopularResponse> {
  return request<PopularResponse>(`/popular${qs({ k })}`, { signal });
}

/**
 * POST /session/foryou — labelled, Netflix-style rows for an anonymous visitor,
 * built from their localStorage taste profile.
 */
export function sessionForYou(
  ratings: SessionRating[],
  signal?: AbortSignal
): Promise<ForYouResponse> {
  return request<ForYouResponse>(`/session/foryou`, {
    method: "POST",
    body: { ratings },
    signal,
  });
}

/**
 * POST /session/recommend — Top-K for an anonymous visitor's localStorage
 * profile, with an optional method + diversity knob.
 */
export function sessionRecommend(
  ratings: SessionRating[],
  options: { method?: RecMethod; k?: number; diversity?: number } = {},
  signal?: AbortSignal
): Promise<SessionRecommendResponse> {
  const { method = "hybrid", k = 14, diversity } = options;
  return request<SessionRecommendResponse>(`/session/recommend`, {
    method: "POST",
    body: { ratings, method, k, diversity },
    signal,
  });
}

/** GET /foryou/{user_id} — labelled rows feed for a known demo user. */
export function getForYou(
  userId: number,
  signal?: AbortSignal
): Promise<ForYouResponse> {
  return request<ForYouResponse>(`/foryou/${userId}`, { signal });
}

/**
 * GET /recommend?user_id&method&k&diversity — Top-K recommendations for a demo
 * user. `diversity` (0..1) trades relevance for MMR-style variety; omit it to
 * use the backend default.
 */
export function getRecommendations(
  userId: number,
  method: RecMethod,
  k = 10,
  diversity?: number,
  signal?: AbortSignal
): Promise<RecommendResponse> {
  return request<RecommendResponse>(
    `/recommend${qs({ user_id: userId, method, k, diversity })}`,
    { signal }
  );
}

/** POST /arena — compare several methods for one user, side by side.
 * Backend returns `{ user_id, results: { method: VelaMovie[] } }`; we adapt it to
 * ordered columns matching the requested method order. */
export async function compareMethods(
  userId: number,
  methods: RecMethod[],
  k = 10,
  signal?: AbortSignal
): Promise<ArenaResponse> {
  const res = await request<{ user_id: number; results: Record<string, VelaMovie[]> }>(
    `/arena`,
    { method: "POST", body: { user_id: userId, methods, k }, signal }
  );
  return {
    user_id: res.user_id,
    k,
    columns: methods.map((m) => ({ method: m, items: res.results?.[m] ?? [] })),
  };
}

/** GET /evaluate?methods&k — offline metrics table for a set of methods. */
export async function getEvaluation(
  methods: RecMethod[],
  k = 10,
  signal?: AbortSignal
): Promise<EvaluationResponse> {
  // Backend returns `{ k, metrics: [{ method, "precision@k": …, … }] }` (one row
  // per method). Adapt to ordered metric ids + per-method rows, filtered to the
  // requested methods (in the order requested).
  const res = await request<{ k: number; metrics: Array<Record<string, unknown>> }>(
    `/evaluate${qs({ k })}`,
    { signal }
  );
  const raw = res.metrics ?? [];
  const byMethod = new Map(raw.map((r) => [String(r.method), r]));
  const rowsRaw = methods.map((m) => byMethod.get(m)).filter(Boolean) as Array<
    Record<string, unknown>
  >;
  const source = rowsRaw[0] ?? raw[0] ?? {};
  const metricKeys = Object.keys(source).filter(
    (key) => key !== "method" && key !== "n_eval_users" && typeof source[key] === "number"
  );
  const rows: EvaluationRow[] = rowsRaw.map((r) => ({
    method: r.method as RecMethod,
    metrics: Object.fromEntries(metricKeys.map((mk) => [mk, Number(r[mk] ?? 0)])),
  }));
  return { k: res.k, metrics: metricKeys, rows };
}

/** GET /taste/{user_id} — taste DNA (genre weights + summary + top movies). */
export async function getTaste(
  userId: number,
  signal?: AbortSignal
): Promise<TasteResponse> {
  // Backend returns `top_genres` as [genre, weight] pairs; adapt to {genre,weight}.
  const res = await request<{
    user_id: number;
    summary: string;
    top_genres: [string, number][];
    top_movies: VelaMovie[];
  }>(`/taste/${userId}`, { signal });
  return {
    user_id: res.user_id,
    summary: res.summary,
    genres: (res.top_genres ?? []).map(([genre, weight]) => ({ genre, weight })),
    top_movies: res.top_movies ?? [],
  };
}

/** GET /galaxy?n_clusters — 2D projection of the catalog colored by cluster. */
export async function getGalaxy(
  nClusters?: number,
  signal?: AbortSignal
): Promise<GalaxyResponse> {
  // Backend points use `movieId`; cluster summaries carry `top_genres` we surface
  // as human cluster labels.
  const res = await request<{
    n_clusters: number;
    points: Array<{ movieId?: number; id?: number; title: string; x: number; y: number; cluster: number; poster_url?: string | null; genres?: string[] }>;
    clusters?: Array<{ cluster: number; top_genres?: string[] }>;
  }>(`/galaxy${qs({ n_clusters: nClusters })}`, { signal });
  const cluster_labels: Record<string, string> = {};
  (res.clusters ?? []).forEach((c) => {
    if (c.top_genres?.length) {
      cluster_labels[String(c.cluster)] = c.top_genres.slice(0, 2).join(" · ");
    }
  });
  return {
    n_clusters: res.n_clusters,
    cluster_labels,
    points: (res.points ?? []).map((p) => ({
      id: p.movieId ?? p.id ?? 0,
      title: p.title,
      x: p.x,
      y: p.y,
      cluster: p.cluster,
      poster_url: p.poster_url ?? null,
      genres: p.genres ?? [],
    })),
  };
}

/** POST /chat — conversational recommendations. Backend returns
 * `{ reply, llm, recommendations }`; we surface `recommendations` as `movies`. */
export async function chat(
  userId: number,
  message: string,
  history: ChatMessage[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const res = await request<{ reply: string; recommendations?: VelaMovie[] }>(`/chat`, {
    method: "POST",
    body: { user_id: userId, message, history },
    signal,
  });
  return { reply: res.reply, movies: res.recommendations ?? [] };
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
