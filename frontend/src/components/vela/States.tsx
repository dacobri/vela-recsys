import { FC, ReactNode } from "react";
import { LuServerCrash, LuInbox } from "react-icons/lu";

import { cn } from "@/utils/helper";

/** Inline spinner with the Vela loader animation. */
export const Spinner: FC<{ className?: string; label?: string }> = ({
  className,
  label,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-4 py-16 text-muted",
      className
    )}
  >
    <div className="loader" />
    {label && <p className="text-[14px]">{label}</p>}
  </div>
);

interface PanelStateProps {
  title: string;
  message?: ReactNode;
  icon?: "empty" | "error";
  action?: ReactNode;
  className?: string;
}

/**
 * Tasteful empty / error panel. Used when the backend isn't running or returns
 * nothing — Vela should never crash to a blank screen.
 */
export const PanelState: FC<PanelStateProps> = ({
  title,
  message,
  icon = "empty",
  action,
  className,
}) => {
  const Icon = icon === "error" ? LuServerCrash : LuInbox;
  return (
    <div
      className={cn(
        "surface-panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className
      )}
    >
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2 text-[24px]",
          icon === "error" ? "text-accent" : "text-muted"
        )}
      >
        <Icon />
      </span>
      <h3 className="text-[17px] font-semibold text-primary">{title}</h3>
      {message && (
        <p className="max-w-[460px] text-[14px] leading-relaxed text-muted">
          {message}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

/** Standard "backend offline" copy reused across pages. */
export const BackendOfflineState: FC<{
  detail?: string;
  action?: ReactNode;
}> = ({ detail, action }) => (
  <PanelState
    icon="error"
    title="Can't reach the Vela backend"
    message={
      detail ||
      "Start the FastAPI server (default http://localhost:8000) and this page will come alive. Set VITE_API_URL in .env.local to point elsewhere."
    }
    action={action}
  />
);
