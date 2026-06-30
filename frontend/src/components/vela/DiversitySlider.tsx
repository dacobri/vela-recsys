import { FC } from "react";

import { cn } from "@/utils/helper";

interface DiversitySliderProps {
  /** current diversity weight, 0..1 */
  value: number;
  onChange: (diversity: number) => void;
  className?: string;
}

/**
 * Labelled 0–1 range slider for the MMR diversity / serendipity weight (λ).
 * 0 = pure relevance, 1 = maximum variety. Passed straight to the backend
 * `diversity` parameter on the Lab "Recommend" page.
 */
const DiversitySlider: FC<DiversitySliderProps> = ({
  value,
  onChange,
  className,
}) => (
  <label className={cn("flex items-center gap-3", className)}>
    <span className="whitespace-nowrap text-[13.5px] text-muted">
      Diversity
    </span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="vela-range h-1.5 w-[140px] cursor-pointer appearance-none rounded-full bg-border accent-accent"
      aria-label="Diversity weight (0 = relevant, 1 = varied)"
    />
    <span className="w-9 text-center text-[14px] font-semibold text-accent tabular-nums">
      {value.toFixed(2)}
    </span>
  </label>
);

export default DiversitySlider;
