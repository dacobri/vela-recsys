import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LuSparkles, LuSwords, LuArrowRight } from "react-icons/lu";

import { Loader, Section } from "@/common";
import { Hero, VelaRail } from "./components";

import { useGetShowsQuery } from "@/services/TMDB";
import { getUsers } from "@/services/velaApi";
import { accentButton, ghostButton, mainHeading, maxWidth } from "@/styles";
import { sections } from "@/constants";
import { cn } from "@/utils/helper";
import logoIcon from "@/assets/svg/vela-icon.svg";

// Branded hero shown when TMDB imagery isn't available yet (e.g. no API key).
const FallbackHero = () => (
  <section
    className="relative flex items-center lg:h-[80vh] sm:h-[560px] xs:h-[480px] h-[440px] w-full overflow-hidden"
    style={{
      background:
        "radial-gradient(1200px 600px at 70% -10%, rgba(242,193,78,0.10), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(127,181,255,0.06), transparent 60%)",
    }}
  >
    <div className={cn(maxWidth, "flex flex-col gap-6")}>
      <img src={logoIcon} alt="Vela" className="h-14 w-14 rounded-xl" />
      <h1 className={cn(mainHeading, "sm:max-w-[640px] max-w-none")}>
        Your personal map of cinema.
      </h1>
      <p className="max-w-[560px] text-[15.5px] leading-relaxed text-gray-300">
        Vela turns a constellation of recommendation methods — from classic
        collaborative filtering to semantic embeddings and an LLM re-ranker —
        into one place to discover films, compare algorithms, and explore your
        taste.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Link to="/recommend" className={accentButton}>
          <LuSparkles /> Get recommendations
        </Link>
        <Link to="/arena" className={ghostButton}>
          <LuSwords /> Open the arena
        </Link>
      </div>
    </div>
  </section>
);

const QuickLinks = () => {
  const links = [
    {
      to: "/recommend",
      title: "Recommend",
      desc: "Top-K picks per method, with scores & reasons.",
      icon: LuSparkles,
    },
    {
      to: "/arena",
      title: "Arena",
      desc: "Compare methods head-to-head, blind if you like.",
      icon: LuSwords,
    },
    {
      to: "/taste-dna",
      title: "Taste DNA",
      desc: "A genre fingerprint of any user's taste.",
      icon: LuArrowRight,
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {links.map(({ to, title, desc, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="surface-panel group flex flex-col gap-2 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-accent text-[20px]">
            <Icon />
          </span>
          <h3 className="mt-1 text-[16px] font-semibold text-primary">
            {title}
          </h3>
          <p className="text-[13.5px] leading-relaxed text-muted">{desc}</p>
        </Link>
      ))}
    </div>
  );
};

const Home = () => {
  const { data, isLoading, isError } = useGetShowsQuery({
    category: "movie",
    type: "popular",
    page: 1,
  });

  // A sample user to power the Home recommendation rails.
  const [sampleUserId, setSampleUserId] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getUsers(1, 0, controller.signal)
      .then((res) => {
        if (res.users.length > 0) setSampleUserId(res.users[0].id);
      })
      .catch(() => {
        /* backend offline — rails simply won't render */
      });
    return () => controller.abort();
  }, []);

  // Only the hero blocks on TMDB; if TMDB is loading we still show the loader.
  if (isLoading) {
    return <Loader />;
  }

  const popularMovies = data?.results?.slice(0, 5);
  const heroAvailable = !isError && popularMovies && popularMovies.length > 0;

  return (
    <>
      {heroAvailable ? <Hero movies={popularMovies} /> : <FallbackHero />}

      <div className={cn(maxWidth, "lg:mt-12 md:mt-8 sm:mt-6 xs:mt-4 mt-6")}>
        {/* Vela recommendation rails (backed by the FastAPI backend) */}
        {sampleUserId != null && (
          <>
            <VelaRail
              title="Recommended for you"
              userId={sampleUserId}
              method="hybrid"
            />
            <VelaRail
              title="From your favourite genres"
              userId={sampleUserId}
              method="content"
            />
            <VelaRail
              title="Discover something new"
              userId={sampleUserId}
              method="semantic"
            />
          </>
        )}

        {/* Quick links into the Vela tools */}
        <div className="lg:my-10 my-8">
          <QuickLinks />
        </div>

        {/* TMDB browse rails — only render when TMDB is reachable */}
        {heroAvailable &&
          sections.map(({ title, category, type }) => (
            <Section title={title} category={category} type={type} key={title} />
          ))}
      </div>
    </>
  );
};

export default Home;
