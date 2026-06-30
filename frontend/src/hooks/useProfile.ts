import { useCallback, useEffect, useState } from "react";

import {
  getProfile,
  subscribeProfile,
  type VelaProfile,
} from "@/utils/profile";

/**
 * Reactive view of the consumer taste profile in localStorage. Re-renders the
 * caller whenever the profile changes (this tab or another), so the header
 * "Refine taste" affordance, Home, and the detail page stay in sync.
 */
export function useProfile(): VelaProfile {
  const [profile, setProfile] = useState<VelaProfile>(() => getProfile());

  const refresh = useCallback(() => setProfile(getProfile()), []);

  useEffect(() => {
    // Re-read once on mount (handles SSR/hydration + changes before subscribe).
    refresh();
    return subscribeProfile(refresh);
  }, [refresh]);

  return profile;
}
