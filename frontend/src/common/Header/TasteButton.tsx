import { Link } from "react-router-dom";
import { LuHeart, LuSparkles } from "react-icons/lu";

import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/utils/helper";

/**
 * Header affordance for the consumer taste profile. When the visitor has saved
 * picks it shows a compact "taste" pill (count + refine); before that, a subtle
 * "Build taste" nudge. Both route to onboarding (`/welcome`).
 */
const TasteButton = ({ className }: { className?: string }) => {
  const { ratings } = useProfile();
  const count = ratings.length;

  if (count > 0) {
    return (
      <Link
        to="/welcome"
        title="Refine your taste"
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-[7px] text-[13px] font-medium text-gray-200 transition-all duration-300 hover:-translate-y-[1px] hover:border-accent/60 hover:text-primary",
          className
        )}
      >
        <LuHeart className="text-accent" />
        <span className="tabular-nums">{count}</span>
        <span className="hidden xl:inline">in your taste</span>
      </Link>
    );
  }

  return (
    <Link
      to="/welcome"
      className={cn(
        "flex items-center gap-2 rounded-full bg-accent px-3.5 py-[7px] text-[13px] font-semibold text-accent-text shadow-glow transition-all duration-300 hover:-translate-y-[1px]",
        className
      )}
    >
      <LuSparkles />
      Build taste
    </Link>
  );
};

export default TasteButton;
