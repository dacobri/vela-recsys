import { useCallback, useEffect, useState } from "react";
import { LuSparkles } from "react-icons/lu";

import {
  PageHeader,
  UserPicker,
  MethodSelector,
  TopKSlider,
  DiversitySlider,
  MoviePosterCard,
  Spinner,
  BackendOfflineState,
  PanelState,
} from "@/components/vela";
import {
  getRecommendations,
  METHOD_META,
  RecMethod,
  VelaMovie,
} from "@/services/velaApi";
import { pageWrapper, sectionCard } from "@/styles";

const Recommend = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [method, setMethod] = useState<RecMethod>("hybrid");
  const [k, setK] = useState<number>(12);
  // Default to a small non-zero λ so the diversity feature is visible by default.
  const [diversity, setDiversity] = useState<number>(0.2);

  const [items, setItems] = useState<VelaMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecs = useCallback(
    (signal?: AbortSignal) => {
      if (userId == null) return;
      setLoading(true);
      setError(null);
      getRecommendations(userId, method, k, diversity, signal)
        .then((res) => setItems(res.items))
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setError(err?.message ?? "Something went wrong.");
          setItems([]);
        })
        .finally(() => setLoading(false));
    },
    [userId, method, k, diversity]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchRecs(controller.signal);
    return () => controller.abort();
  }, [fetchRecs]);

  return (
    <div className={pageWrapper}>
      <PageHeader
        icon={LuSparkles}
        title="Recommend"
        subtitle="Pick a user, choose a method, and dial in how many titles you want and how varied they are. Each card shows its ranking score and — where the model offers one — a reason."
      />

      <div className={`${sectionCard} mb-8 flex flex-col gap-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
              User
            </span>
            <UserPicker value={userId} onChange={setUserId} />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
                Results
              </span>
              <TopKSlider value={k} onChange={setK} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
                Diversity (λ)
              </span>
              <DiversitySlider value={diversity} onChange={setDiversity} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
            Method
          </span>
          <MethodSelector value={method} onChange={setMethod} />
          <p className="text-[13px] text-muted">{METHOD_META[method].blurb}</p>
        </div>
      </div>

      {loading ? (
        <Spinner label="Ranking titles…" />
      ) : error ? (
        <BackendOfflineState detail={error} />
      ) : items.length === 0 ? (
        <PanelState
          title="No recommendations yet"
          message="Select a user above to generate a personalized ranking."
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((movie, idx) => (
            <MoviePosterCard
              key={movie.id}
              movie={movie}
              rank={idx + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Recommend;
