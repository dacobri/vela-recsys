import { FC } from "react";

import { METHOD_META, REC_METHODS, RecMethod } from "@/services/velaApi";
import { cn } from "@/utils/helper";

interface MethodSelectorProps {
  value: RecMethod;
  onChange: (method: RecMethod) => void;
  /** restrict the selectable methods (defaults to all). */
  methods?: RecMethod[];
  className?: string;
}

/** Segmented control over the recommendation methods enum. */
const MethodSelector: FC<MethodSelectorProps> = ({
  value,
  onChange,
  methods = REC_METHODS,
  className,
}) => (
  <div
    role="tablist"
    aria-label="Recommendation method"
    className={cn("flex flex-wrap gap-2", className)}
  >
    {methods.map((method) => {
      const active = method === value;
      return (
        <button
          key={method}
          role="tab"
          aria-selected={active}
          type="button"
          title={METHOD_META[method].blurb}
          onClick={() => onChange(method)}
          className={cn(
            "vela-chip rounded-full px-4 py-[7px] text-[13.5px] font-medium text-muted",
            active && "vela-chip--active"
          )}
        >
          {METHOD_META[method].label}
        </button>
      );
    })}
  </div>
);

export default MethodSelector;
