import { FC } from "react";

import { cn } from "@/utils/helper";

interface TopKSliderProps {
  value: number;
  onChange: (k: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

/** Labelled range slider for the Top-K parameter. */
const TopKSlider: FC<TopKSliderProps> = ({
  value,
  onChange,
  min = 5,
  max = 30,
  className,
}) => (
  <label className={cn("flex items-center gap-3", className)}>
    <span className="whitespace-nowrap text-[13.5px] text-muted">
      Top-K
    </span>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="vela-range h-1.5 w-[140px] cursor-pointer appearance-none rounded-full bg-border accent-accent"
      aria-label="Number of recommendations"
    />
    <span className="w-7 text-center text-[14px] font-semibold text-accent tabular-nums">
      {value}
    </span>
  </label>
);

export default TopKSlider;
