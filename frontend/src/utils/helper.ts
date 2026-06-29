import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

export const getErrorMessage = (error: any) => {
  let errorMessage;

  if (error) {
    if ("status" in error) {
      const errMsg =
        "error" in error ? error.error : JSON.stringify(error.data);

      errorMessage = errMsg;
    } else {
      errorMessage = error.message;
    }
  } else {
    errorMessage = "Unable to fetch the data. Please try again later.";
  }

  return errorMessage;
};

/**
 * Resolve an image URL for posters/backdrops.
 * - Full URLs (Vela backend `poster_url`/`backdrop_url`, e.g. "https://…") pass
 *   through untouched.
 * - Bare TMDB paths (e.g. "/abc.jpg") are prefixed with the TMDB image CDN.
 * - Empty/null values fall back to a local placeholder so <img> never 404s with
 *   a broken-image icon.
 */
export const imageUrl = (path?: string | null): string => {
  if (!path) return "/poster-fallback.svg";
  if (/^https?:\/\//i.test(path)) return path;
  return `${TMDB_IMAGE_BASE}/${path.replace(/^\//, "")}`;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
