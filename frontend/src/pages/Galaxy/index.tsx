import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PiPlanetDuotone } from "react-icons/pi";
import { LuX } from "react-icons/lu";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import Image from "@/common/Image";
import {
  PageHeader,
  Spinner,
  BackendOfflineState,
  PanelState,
} from "@/components/vela";
import { GalaxyPoint, getGalaxy, GalaxyResponse } from "@/services/velaApi";
import { ghostButton, pageWrapper, sectionCard } from "@/styles";
import { cn, imageUrl } from "@/utils/helper";

// Distinct, dark-friendly cluster palette (gold-anchored but varied for legibility).
const CLUSTER_COLORS = [
  "#F2C14E",
  "#7FB5FF",
  "#6FE3C2",
  "#FF9F7F",
  "#C99BFF",
  "#FFD56B",
  "#86E07A",
  "#FF8FB1",
  "#5FD0E0",
  "#E0B0FF",
  "#FFC04D",
  "#A0E57A",
];

const clusterColor = (cluster: number) =>
  CLUSTER_COLORS[((cluster % CLUSTER_COLORS.length) + CLUSTER_COLORS.length) %
    CLUSTER_COLORS.length];

const Galaxy = () => {
  const [nClusters, setNClusters] = useState<number>(8);
  const [data, setData] = useState<GalaxyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GalaxyPoint | null>(null);

  const fetchGalaxy = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      getGalaxy(nClusters, signal)
        .then((res) => {
          setData(res);
          setSelected(null);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setError(err?.message ?? "Something went wrong.");
          setData(null);
        })
        .finally(() => setLoading(false));
    },
    [nClusters]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchGalaxy(controller.signal);
    return () => controller.abort();
  }, [fetchGalaxy]);

  // group points by cluster -> one <Scatter> series per cluster (for color)
  const series = useMemo(() => {
    if (!data) return [];
    const groups = new Map<number, GalaxyPoint[]>();
    data.points.forEach((p) => {
      const arr = groups.get(p.cluster) ?? [];
      arr.push(p);
      groups.set(p.cluster, arr);
    });
    // recharts (SVG) can't smoothly draw ~10k points — render a representative
    // sample (~2.5k total), but keep the TRUE cluster size for the legend.
    const MAX_RENDER = 2500;
    const step = Math.max(1, Math.round(data.points.length / MAX_RENDER));
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cluster, points]) => ({
        cluster,
        label: data.cluster_labels?.[String(cluster)] ?? `Cluster ${cluster}`,
        color: clusterColor(cluster),
        points: step === 1 ? points : points.filter((_, i) => i % step === 0),
        count: points.length,
      }));
  }, [data]);

  return (
    <div className={pageWrapper}>
      <PageHeader
        icon={PiPlanetDuotone}
        title="Movie Galaxy"
        subtitle="The catalog projected to two dimensions and colored by cluster — neighbourhoods of films that sit close in embedding space. Click a star to inspect it."
      >
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted">Clusters</span>
          <select
            value={nClusters}
            onChange={(e) => setNClusters(Number(e.target.value))}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-[14px] text-primary outline-none focus:border-accent/60"
          >
            {[4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      {loading ? (
        <Spinner label="Mapping the galaxy…" />
      ) : error ? (
        <BackendOfflineState detail={error} />
      ) : !data || data.points.length === 0 ? (
        <PanelState
          title="No galaxy to show"
          message="The backend returned no points. Make sure the clustering / projection endpoint is ready."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className={cn(sectionCard, "relative")}>
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
                  <CartesianGrid stroke="#1E1A2B" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    tick={{ fill: "#5b5570", fontSize: 11 }}
                    axisLine={{ stroke: "#2A2540" }}
                    tickLine={false}
                    name="x"
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    tick={{ fill: "#5b5570", fontSize: 11 }}
                    axisLine={{ stroke: "#2A2540" }}
                    tickLine={false}
                    name="y"
                  />
                  <ZAxis range={[28, 28]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3", stroke: "#2A2540" }}
                    contentStyle={{
                      background: "#16131F",
                      border: "1px solid #2A2540",
                      borderRadius: 12,
                      color: "#F6F4FF",
                    }}
                    formatter={(_value, _name, props: any) => {
                      const p = props?.payload as GalaxyPoint | undefined;
                      return [p?.title ?? "", "Title"];
                    }}
                  />
                  {series.map((s) => (
                    <Scatter
                      key={s.cluster}
                      name={s.label}
                      data={s.points}
                      fill={s.color}
                      fillOpacity={0.78}
                      isAnimationActive={false}
                      onClick={(point: any) =>
                        setSelected(point?.payload as GalaxyPoint)
                      }
                      className="cursor-pointer"
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* side panel: legend + selected movie */}
          <aside className="flex flex-col gap-6">
            {selected ? (
              <div className={cn(sectionCard, "relative")}>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelected(null)}
                  className="absolute right-3 top-3 text-muted transition-colors hover:text-primary"
                >
                  <LuX />
                </button>
                <div className="flex gap-4">
                  <div className="h-[132px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                    <Image
                      width={88}
                      height={132}
                      src={imageUrl(selected.poster_url)}
                      alt={selected.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <span
                      className="inline-block rounded-full px-2 py-[2px] text-[11px] font-semibold"
                      style={{
                        background: `${clusterColor(selected.cluster)}22`,
                        color: clusterColor(selected.cluster),
                      }}
                    >
                      {data.cluster_labels?.[String(selected.cluster)] ??
                        `Cluster ${selected.cluster}`}
                    </span>
                    <h4 className="mt-2 text-[15.5px] font-semibold leading-snug text-primary">
                      {selected.title}
                    </h4>
                    {selected.genres && selected.genres.length > 0 && (
                      <p className="mt-1 text-[12.5px] text-muted">
                        {selected.genres.slice(0, 3).join(" · ")}
                      </p>
                    )}
                    <Link
                      to={`/movie/${selected.id}`}
                      className={cn(ghostButton, "mt-3 px-4 py-[6px] text-[13px]")}
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn(sectionCard, "text-center")}>
                <p className="text-[13.5px] text-muted">
                  Click any star to see the film it represents.
                </p>
              </div>
            )}

            <div className={sectionCard}>
              <h4 className="mb-3 text-[14px] font-semibold uppercase tracking-wide text-muted">
                Clusters
              </h4>
              <ul className="flex flex-col gap-2">
                {series.map((s) => (
                  <li
                    key={s.cluster}
                    className="flex items-center gap-2 text-[13.5px] text-gray-200"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="truncate">{s.label}</span>
                    <span className="ml-auto text-[12px] text-muted">
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Galaxy;
