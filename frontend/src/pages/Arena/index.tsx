import { useCallback, useEffect, useState } from "react";
import { LuSwords, LuEye, LuEyeOff } from "react-icons/lu";

import MoviesSlides from "@/common/Section/MoviesSlides";
import {
  PageHeader,
  UserPicker,
  TopKSlider,
  Spinner,
  BackendOfflineState,
  PanelState,
} from "@/components/vela";
import {
  ArenaColumn,
  compareMethods,
  METHOD_META,
  REC_METHODS,
  RecMethod,
  toIMovies,
} from "@/services/velaApi";
import { ghostButton, pageWrapper, sectionCard } from "@/styles";
import { cn } from "@/utils/helper";

const DEFAULT_METHODS: RecMethod[] = ["popularity", "itemcf", "mf", "hybrid"];
const MAX_METHODS = 4;
const MIN_METHODS = 2;

const Arena = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [methods, setMethods] = useState<RecMethod[]>(DEFAULT_METHODS);
  const [k, setK] = useState<number>(10);
  const [blind, setBlind] = useState(false);

  const [columns, setColumns] = useState<ArenaColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMethod = (m: RecMethod) => {
    setMethods((prev) => {
      if (prev.includes(m)) {
        if (prev.length <= MIN_METHODS) return prev;
        return prev.filter((x) => x !== m);
      }
      if (prev.length >= MAX_METHODS) return prev;
      return [...prev, m];
    });
  };

  const fetchArena = useCallback(
    (signal?: AbortSignal) => {
      if (userId == null || methods.length < MIN_METHODS) return;
      setLoading(true);
      setError(null);
      compareMethods(userId, methods, k, signal)
        .then((res) => setColumns(res.columns))
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setError(err?.message ?? "Something went wrong.");
          setColumns([]);
        })
        .finally(() => setLoading(false));
    },
    [userId, methods, k]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchArena(controller.signal);
    return () => controller.abort();
  }, [fetchArena]);

  return (
    <div className={pageWrapper}>
      <PageHeader
        icon={LuSwords}
        title="Algorithm Arena"
        subtitle="Put methods head-to-head for the same user. Toggle blind mode to hide the labels and judge the rows on the titles alone."
      >
        <button
          type="button"
          onClick={() => setBlind((p) => !p)}
          className={cn(ghostButton, blind && "border-accent/60 text-primary")}
        >
          {blind ? <LuEyeOff /> : <LuEye />}
          {blind ? "Blind A/B: on" : "Blind A/B: off"}
        </button>
      </PageHeader>

      <div className={`${sectionCard} mb-8 flex flex-col gap-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
              User
            </span>
            <UserPicker value={userId} onChange={setUserId} />
          </div>
          <TopKSlider value={k} onChange={setK} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
            Methods · pick {MIN_METHODS}–{MAX_METHODS} ({methods.length} selected)
          </span>
          <div className="flex flex-wrap gap-2">
            {REC_METHODS.map((m, i) => {
              const active = methods.includes(m);
              const atMax = !active && methods.length >= MAX_METHODS;
              const atMin = active && methods.length <= MIN_METHODS;
              // In blind mode, never expose the method identity (label or
              // tooltip blurb) — that would leak the answer being judged.
              return (
                <button
                  key={m}
                  type="button"
                  disabled={atMax}
                  title={blind ? undefined : METHOD_META[m].blurb}
                  onClick={() => toggleMethod(m)}
                  className={cn(
                    "vela-chip rounded-full px-4 py-[7px] text-[13.5px] font-medium text-muted disabled:opacity-40 disabled:hover:border-border",
                    active && "vela-chip--active",
                    atMin && "cursor-default"
                  )}
                >
                  {blind ? `Option ${i + 1}` : METHOD_META[m].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner label="Running the arena…" />
      ) : error ? (
        <BackendOfflineState detail={error} />
      ) : columns.length === 0 ? (
        <PanelState
          title="No matchup yet"
          message="Pick a user and at least two methods to see them compete."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {columns.map((col, idx) => (
            <section key={col.method} className={sectionCard}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[13px] font-bold text-accent ring-1 ring-border">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <h3 className="text-[18px] font-semibold text-primary">
                    {blind ? `Method ${String.fromCharCode(65 + idx)}` : METHOD_META[col.method].label}
                  </h3>
                </div>
                {!blind && (
                  <span className="hidden text-[12.5px] text-muted sm:block">
                    {METHOD_META[col.method].blurb}
                  </span>
                )}
              </div>
              {col.items.length > 0 ? (
                <MoviesSlides movies={toIMovies(col.items)} category="movie" />
              ) : (
                <p className="py-6 text-center text-[14px] text-muted">
                  No results for this method.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Arena;
