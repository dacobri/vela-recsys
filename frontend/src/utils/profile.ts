/**
 * Vela consumer taste profile — persisted in localStorage.
 *
 * The consumer layer has no backend auth: a casual visitor builds a taste
 * profile by hearting movies during onboarding (and from the detail page), and
 * we keep it in `localStorage` so it is remembered across visits. The shape
 * matches what the backend session endpoints expect:
 *   { ratings: [{ id, rating }] }
 *
 * A tiny pub/sub (custom window event + storage event) lets any component —
 * Home, the header "Refine taste" affordance, the detail page — react when the
 * profile changes without prop-drilling or a global store.
 */

export interface Rating {
  id: number;
  rating: number;
}

export interface VelaProfile {
  ratings: Rating[];
}

export const PROFILE_KEY = "vela_profile";
/** Fired on `window` whenever the saved profile changes (this tab). */
export const PROFILE_EVENT = "vela:profile";

const emptyProfile = (): VelaProfile => ({ ratings: [] });

function isRating(value: unknown): value is Rating {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Rating).id === "number" &&
    typeof (value as Rating).rating === "number"
  );
}

/** Read the saved profile. Returns an empty profile if none / malformed. */
export function getProfile(): VelaProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as VelaProfile).ratings)
    ) {
      const ratings = (parsed as VelaProfile).ratings.filter(isRating);
      return { ratings };
    }
  } catch {
    /* corrupt value — fall through to empty */
  }
  return emptyProfile();
}

/** True when the visitor has saved at least one rating. */
export function hasProfile(): boolean {
  return getProfile().ratings.length > 0;
}

/** Number of titles in the saved profile. */
export function profileSize(): number {
  return getProfile().ratings.length;
}

function persist(profile: VelaProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage full / unavailable — ignore, the UI still works in-session */
  }
  // Notify listeners in this tab (the native `storage` event only fires in
  // *other* tabs, so we dispatch our own for same-tab reactivity).
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT));
}

/** Replace the entire profile (used by onboarding's "See my picks"). */
export function saveProfile(ratings: Rating[]): VelaProfile {
  const profile: VelaProfile = { ratings };
  persist(profile);
  return profile;
}

/** True if a given movie id is already in the profile. */
export function isInProfile(id: number): boolean {
  return getProfile().ratings.some((r) => r.id === id);
}

/**
 * Add (or update) a single movie in the profile. Defaults to a 5★ "I love
 * this" signal, matching how onboarding hearts work.
 */
export function addToProfile(id: number, rating = 5): VelaProfile {
  const current = getProfile();
  const next = current.ratings.filter((r) => r.id !== id);
  next.push({ id, rating });
  return saveProfile(next);
}

/** Remove a single movie from the profile. */
export function removeFromProfile(id: number): VelaProfile {
  const current = getProfile();
  return saveProfile(current.ratings.filter((r) => r.id !== id));
}

/** Toggle a movie in/out of the profile. Returns the new membership state. */
export function toggleInProfile(id: number, rating = 5): boolean {
  if (isInProfile(id)) {
    removeFromProfile(id);
    return false;
  }
  addToProfile(id, rating);
  return true;
}

/** Wipe the profile entirely (used by "Start over" in onboarding). */
export function clearProfile(): void {
  persist(emptyProfile());
}

/**
 * Subscribe to profile changes (same-tab custom event + cross-tab storage
 * event). Returns an unsubscribe function for `useEffect` cleanup.
 */
export function subscribeProfile(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PROFILE_KEY) listener();
  };
  window.addEventListener(PROFILE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PROFILE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
