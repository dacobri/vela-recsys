import { useCallback, useEffect, useMemo, useState } from "react";
import { TbDna2 } from "react-icons/tb";

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

// Hand-rolled SVG radar — reliable and fully styleable (recharts' RadarChart
// computed null polygon points here).
const GenreRadar = ({
  data,
  axisMax,
}: {
  data: { genre: string; value: number }[];
  axisMax: number;
}) => {
  const n = data.length;
  const cx = 160;
  const cy = 150;
  const R = 104;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, r: number): [number, number] => [
    cx + r * Math.cos(ang(i)),
    cy + r * Math.sin(ang(i)),
  ];
  const ringPoly = (f: number) =>
    data.map((_, i) => pt(i, f * R).join(",")).join(" ");
  const dataPoly = data
    .map((d, i) => pt(i, (Math.max(0, d.value) / axisMax) * R).join(","))
    .join(" ");

  return (
    <svg viewBox="0 0 320 300" className="h-full w-full" role="img" aria-label="Genre radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ringPoly(f)} fill="none" stroke="#2A2540" strokeWidth={1} />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2A2540" strokeWidth={1} />;
      })}
      <polygon points={dataPoly} fill="#F2C14E" fillOpacity={0.32} stroke="#F2C14E" strokeWidth={2} />
      {data.map((d, i) => {
        const [x, y] = pt(i, (Math.max(0, d.value) / axisMax) * R);
        return <circle key={`d-${i}`} cx={x} cy={y} r={3} fill="#F2C14E" />;
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={`l-${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill="#9A93B2">
            {d.genre}
          </text>
        );
      })}
    </svg>
  );
};

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
    // value = the genre's share of the user's weighted ratings, as a percentage.
    return data.genres
      .slice(0, 8)
      .map((g) => ({ genre: g.genre, value: Math.round(g.weight * 100) }));
  }, [data]);

  // Auto-scale the radial axis to the data — genre shares rarely exceed ~25%, so
  // a fixed 0-100 axis squashes the whole shape into the centre.
  const axisMax = useMemo(() => {
    const m = Math.max(...radarData.map((d) => d.value), 1);
    return Math.max(5, Math.ceil(m / 5) * 5);
  }, [radarData]);

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
                  <GenreRadar data={radarData} axisMax={axisMax} />
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
                          style={{ width: `${(g.value / axisMax) * 100}%` }}
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
