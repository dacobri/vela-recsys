import { AiOutlineHome } from "react-icons/ai";
import { TbMovie } from "react-icons/tb";
import { MdOutlineLiveTv } from "react-icons/md";
import { LuSparkles, LuSwords, LuMessagesSquare } from "react-icons/lu";
import { TbChartBar, TbDna2 } from "react-icons/tb";
import { PiPlanetDuotone } from "react-icons/pi";

import { INavLink } from "../types";

export const navLinks: INavLink[] = [
  {
    title: "home",
    path: "/",
    icon: AiOutlineHome,
  },
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
  {
    title: "chat",
    path: "/chat",
    icon: LuMessagesSquare,
  },
  {
    title: "movies",
    path: "/movie",
    icon: TbMovie,
  },
  {
    title: "tv series",
    path: "/tv",
    icon: MdOutlineLiveTv,
  },
];

export const footerLinks = [
  "home",
  "recommend",
  "arena",
  "evaluation",
  "taste dna",
  "galaxy",
  "chat",
  "movies",
  "tv series",
  "about",
  "privacy",
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
