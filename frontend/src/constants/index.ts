import { AiOutlineHome } from "react-icons/ai";
import { TbMovie } from "react-icons/tb";
import { LuSparkles, LuSwords, LuMessagesSquare, LuFlaskConical } from "react-icons/lu";
import { TbChartBar, TbDna2 } from "react-icons/tb";
import { PiPlanetDuotone } from "react-icons/pi";

import { INavLink } from "../types";

/**
 * Consumer ("front of house") navigation — the streaming-app experience a
 * casual visitor sees first. No algorithm jargon here.
 */
export const consumerLinks: INavLink[] = [
  {
    title: "home",
    path: "/",
    icon: AiOutlineHome,
  },
  {
    title: "browse",
    path: "/browse",
    icon: TbMovie,
  },
  {
    title: "chat",
    path: "/chat",
    icon: LuMessagesSquare,
  },
];

/**
 * Lab ("engine room") navigation — the analytical / transparency tools for
 * power users and the academic story. Grouped under a labelled "Lab" menu.
 */
export const labLinks: INavLink[] = [
  {
    title: "recommend",
    path: "/recommend",
    icon: LuSparkles,
  },
  {
    title: "arena",
    path: "/arena",
    icon: LuSwords,
  },
  {
    title: "evaluation",
    path: "/evaluation",
    icon: TbChartBar,
  },
  {
    title: "taste dna",
    path: "/taste-dna",
    icon: TbDna2,
  },
  {
    title: "galaxy",
    path: "/galaxy",
    icon: PiPlanetDuotone,
  },
];

/** Icon + copy for the "Lab" grouping itself (dropdown trigger / section head). */
export const labGroup = {
  title: "lab",
  label: "Lab",
  caption: "How Vela works",
  icon: LuFlaskConical,
};

/**
 * Flat list of every primary destination — kept for the mobile sidebar fallback
 * and anywhere a single ordered list is convenient.
 */
export const navLinks: INavLink[] = [...consumerLinks, ...labLinks];

export const footerLinks: { title: string; path: string }[] = [
  { title: "home", path: "/" },
  { title: "browse", path: "/browse" },
  { title: "chat", path: "/chat" },
  { title: "build taste", path: "/welcome" },
  { title: "recommend", path: "/recommend" },
  { title: "arena", path: "/arena" },
  { title: "evaluation", path: "/evaluation" },
  { title: "taste dna", path: "/taste-dna" },
  { title: "galaxy", path: "/galaxy" },
];

export const sections = [
  {
    title: "Trending movies",
    category: "movie",
    type: "popular",
  },
  {
    title: "Top rated movies",
    category: "movie",
    type: "top_rated",
  },
  {
    title: "Trending series",
    category: "tv",
    type: "popular",
  },
  {
    title: "Top rated series",
    category: "tv",
    type: "top_rated",
  },
];
