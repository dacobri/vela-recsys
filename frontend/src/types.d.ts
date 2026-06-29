import { IconType } from "react-icons";

export interface INavLink {
  title: string;
  path: string;
  icon: IconType;
}

// Movie shape used by the TMDB-backed template components
// (MovieCard / Poster / MoviesSlides / Hero / Detail).
export interface IMovie {
  id: string;
  poster_path: string;
  original_title: string;
  name: string;
  overview: string;
  backdrop_path: string;
  // Optional Vela enrichments surfaced by the recommendation pages:
  score?: number;
  reason?: string;
}
