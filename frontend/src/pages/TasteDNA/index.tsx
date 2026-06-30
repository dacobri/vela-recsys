import { useCallback, useEffect, useMemo, useState } from "react";
import { TbDna2 } from "react-icons/tb";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  PageHeader,
  UserPicker,
  MoviePosterCard,
  Spinner,
  BackendOfflineState,
  PanelState,
} from "@/components/vela";
import { getTaste, TasteResponse } from "@/services/velaApi";
import { pageWrapper, sectionCard } from "@/styles";

const TasteDNA = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [data, setData] = useState<TasteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTaste = useCallback(
    (signal?: AbortSignal) => {
      if (userId == null) return;
      setLoading(true);
      setError(null);
      getTaste(userId, signal)
        .then(setData)
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setError(err?.message ?? "Something went wrong.");
          setData(null);
        })
        .finally(() => setLoading(false));
    },
    [userId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTaste(controller.signal);
    return () => controller.abort();
  }, [fetchTaste]);

  const radarData = useMemo(() => {
    if (!data) return [];
    // Normalize weights to 0..100 so the radar reads consistently.
    const max = Math.max(...data.genres.map((g) => g.weight), 1);
    return data.genres
      .slice(0, 8)
      .map((g) => ({ genre: g.genre, value: (g.weight / max) * 100 }));
  }, [data]);

  return (
    <div className={pageWrapper}>
      <PageHeader
        icon={TbDna2}
        title="Taste DNA"
        subtitle="A fingerprint of what a user loves — the genres that shape their ratings, a short summary, and the titles most central to their taste."
      >
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
            User
          </span>
          <UserPicker value={userId} onChange={setUserId} />
        </div>
      </PageHeader>

      {loading ? (
        <Spinner label="Sequencing taste…" />
      ) : error ? (
        <BackendOfflineState detail={error} />
      ) : !data ? (
        <PanelState
          title="No taste profile yet"
          message="Pick a user to render their genre fingerprint."
        />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* radar */}
            <section className={sectionCard}>
              <h3 className="mb-2 text-[18px] font-semibold text-primary">
                Genre fingerprint
              </h3>
              {radarData.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-muted">
                  No genre signal for this user.
                </p>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="#2A2540" />
                      <PolarAngleAxis
                        dataKey="genre"
                        tick={{ fill: "#9A93B2", fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        tick={{ fill: "#8b84a3", fontSize: 10 }}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Radar
                        dataKey="value"
                        stroke="#F2C14E"
                        fill="#F2C14E"
                        fillOpacity={0.35}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#16131F",
                          border: "1px solid #2A2540",
                          borderRadius: 12,
                          color: "#F6F4FF",
                        }}
                        formatter={(value: number) => [
                          `${value.toFixed(0)}%`,
                          "Affinity",
                        ]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* summary + genre bars */}
            <section className={sectionCard}>
              <h3 className="mb-3 text-[18px] font-semibold text-primary">
                Taste summary
              </h3>
              <p className="text-[14.5px] leading-relaxed text-primary">
                {data.summary || "No summary available for this user."}
              </p>

              {data.genres.length > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                  {radarData.map((g) => (
                    <div key={g.genre} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted">{g.genre}</span>
                        <span className="text-muted tabular-nums">
                          {g.value.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${g.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* top movies */}
          {data.top_movies.length > 0 && (
            <section>
              <h3 className="mb-4 text-[18px] font-semibold text-primary">
                Signature titles
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {data.top_movies.map((movie) => (
                  <MoviePosterCard
                    key={movie.id}
                    movie={movie}
                    showScore={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default TasteDNA;
