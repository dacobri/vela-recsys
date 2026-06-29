import { useCallback, useEffect, useMemo, useState } from "react";
import { TbChartBar } from "react-icons/tb";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  PageHeader,
  TopKSlider,
  Spinner,
  BackendOfflineState,
  PanelState,
} from "@/components/vela";
import {
  EvaluationResponse,
  getEvaluation,
  METHOD_META,
  RecMethod,
} from "@/services/velaApi";
import { pageWrapper, sectionCard } from "@/styles";
import { cn } from "@/utils/helper";

// Friendly labels for the metric ids the backend returns. Falls back to the raw
// id when an unexpected metric appears.
const METRIC_LABELS: Record<string, string> = {
  precision: "Precision@K",
  recall: "Recall@K",
  ndcg: "NDCG@K",
  map: "MAP",
  coverage: "Coverage",
  diversity: "Diversity",
  novelty: "Novelty",
};

const metricLabel = (id: string) => METRIC_LABELS[id] ?? id;

// Accent-family palette for chart bars (one hue per method).
const BAR_COLORS = [
  "#F2C14E",
  "#F7D27E",
  "#C9A24A",
  "#E0A93B",
  "#B8862A",
  "#FBE3A9",
  "#9A7B2E",
  "#D8B65C",
  "#F2C14E",
];

const Evaluation = () => {
  const [methods] = useState<RecMethod[]>([
    "popularity",
    "content",
    "itemcf",
    "mf",
    "hybrid",
  ]);
  const [k, setK] = useState<number>(10);
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<string>("ndcg");

  const fetchEval = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      getEvaluation(methods, k, signal)
        .then((res) => {
          setData(res);
          if (res.metrics.length > 0 && !res.metrics.includes(activeMetric)) {
            setActiveMetric(res.metrics[0]);
          }
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setError(err?.message ?? "Something went wrong.");
          setData(null);
        })
        .finally(() => setLoading(false));
    },
    // activeMetric intentionally omitted to avoid refetch on tab change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [methods, k]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchEval(controller.signal);
    return () => controller.abort();
  }, [fetchEval]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row) => ({
      method: METHOD_META[row.method]?.label ?? row.method,
      value: row.metrics[activeMetric] ?? 0,
    }));
  }, [data, activeMetric]);

  // best value per metric column (for highlighting in the table)
  const bestByMetric = useMemo(() => {
    const best: Record<string, number> = {};
    if (!data) return best;
    data.metrics.forEach((metric) => {
      best[metric] = Math.max(
        ...data.rows.map((r) => r.metrics[metric] ?? -Infinity)
      );
    });
    return best;
  }, [data]);

  return (
    <div className={pageWrapper}>
      <PageHeader
        icon={TbChartBar}
        title="Evaluation Lab"
        subtitle="Offline ranking metrics on a held-out temporal split. Accuracy (Precision / Recall / NDCG / MAP) sits next to beyond-accuracy measures (Coverage / Diversity / Novelty)."
      >
        <TopKSlider value={k} onChange={setK} />
      </PageHeader>

      {loading ? (
        <Spinner label="Crunching metrics…" />
      ) : error ? (
        <BackendOfflineState detail={error} />
      ) : !data || data.rows.length === 0 ? (
        <PanelState
          title="No evaluation data"
          message="The backend returned no metrics. Make sure the evaluation endpoint is wired up."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* metrics table */}
          <section className={cn(sectionCard, "overflow-x-auto p-0")}>
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-[1] bg-surface px-5 py-4 text-[13px] font-semibold uppercase tracking-wide text-muted">
                    Method
                  </th>
                  {data.metrics.map((metric) => (
                    <th
                      key={metric}
                      className="px-5 py-4 text-right text-[13px] font-semibold uppercase tracking-wide text-muted"
                    >
                      {metricLabel(metric)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.method}
                    className="border-b border-border/60 last:border-0 transition-colors hover:bg-surface-2/50"
                  >
                    <td className="sticky left-0 z-[1] bg-surface px-5 py-4 text-[14.5px] font-medium text-primary">
                      {METHOD_META[row.method]?.label ?? row.method}
                    </td>
                    {data.metrics.map((metric) => {
                      const value = row.metrics[metric];
                      const isBest =
                        value !== undefined &&
                        bestByMetric[metric] === value &&
                        data.rows.length > 1;
                      return (
                        <td
                          key={metric}
                          className={cn(
                            "px-5 py-4 text-right text-[14px] tabular-nums",
                            isBest
                              ? "font-bold text-accent"
                              : "text-gray-200"
                          )}
                        >
                          {value !== undefined ? value.toFixed(4) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* grouped bar chart (per-metric, switchable) */}
          <section className={sectionCard}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[18px] font-semibold text-primary">
                {metricLabel(activeMetric)} by method
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.metrics.map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => setActiveMetric(metric)}
                    className={cn(
                      "vela-chip rounded-full px-3 py-[5px] text-[12.5px] font-medium text-gray-200",
                      metric === activeMetric && "vela-chip--active"
                    )}
                  >
                    {metricLabel(metric)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2540" vertical={false} />
                  <XAxis
                    dataKey="method"
                    tick={{ fill: "#9A93B2", fontSize: 12 }}
                    axisLine={{ stroke: "#2A2540" }}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fill: "#9A93B2", fontSize: 12 }}
                    axisLine={{ stroke: "#2A2540" }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(242,193,78,0.08)" }}
                    contentStyle={{
                      background: "#16131F",
                      border: "1px solid #2A2540",
                      borderRadius: 12,
                      color: "#F6F4FF",
                    }}
                    labelStyle={{ color: "#9A93B2" }}
                    formatter={(value: number) => [
                      value.toFixed(4),
                      metricLabel(activeMetric),
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ color: "#9A93B2", fontSize: 12 }}
                    formatter={() => metricLabel(activeMetric)}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {chartData.map((_, idx) => (
                      <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Evaluation;
