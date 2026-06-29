import { FC, useEffect, useState } from "react";
import { LuUser, LuChevronDown } from "react-icons/lu";

import { getUsers, VelaUser } from "@/services/velaApi";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { cn } from "@/utils/helper";

interface UserPickerProps {
  value: number | null;
  onChange: (userId: number) => void;
  /** how many users to fetch for the dropdown. */
  limit?: number;
  className?: string;
}

const userLabel = (u: VelaUser): string => {
  if (u.label) return u.label;
  const ratings =
    typeof u.n_ratings === "number" ? ` · ${u.n_ratings} ratings` : "";
  return `User ${u.id}${ratings}`;
};

/**
 * Dropdown that loads demo users from the backend. Auto-selects the first user
 * once loaded (if nothing is selected yet). Degrades to a disabled control with
 * a helpful label when the backend is unreachable.
 */
const UserPicker: FC<UserPickerProps> = ({
  value,
  onChange,
  limit = 100,
  className,
}) => {
  const [users, setUsers] = useState<VelaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [open, setOpen] = useState(false);

  const { ref } = useOnClickOutside({
    action: () => setOpen(false),
    enable: open,
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrored(false);

    getUsers(limit, 0, controller.signal)
      .then((res) => {
        setUsers(res.users);
        if (value == null && res.users.length > 0) {
          onChange(res.users[0].id);
        }
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const selected = users.find((u) => u.id === value);
  const buttonLabel = loading
    ? "Loading users…"
    : errored
    ? "Users unavailable"
    : selected
    ? userLabel(selected)
    : value != null
    ? `User ${value}`
    : "Select a user";

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={loading || errored}
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex w-full min-w-[200px] items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-[10px] text-[14.5px] text-primary transition-all duration-300 hover:border-accent/60 disabled:opacity-60 disabled:hover:border-border",
          open && "border-accent/60"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <LuUser className="shrink-0 text-accent" />
          <span className="truncate">{buttonLabel}</span>
        </span>
        <LuChevronDown
          className={cn(
            "shrink-0 text-muted transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      {open && users.length > 0 && (
        <ul className="dark-glass absolute z-30 mt-2 max-h-[320px] w-full overflow-y-auto rounded-xl py-1 shadow-xl scrollbar-thin">
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[14px] transition-colors",
                  u.id === value
                    ? "text-accent"
                    : "text-gray-200 hover:bg-surface-2"
                )}
              >
                <span className="truncate">{userLabel(u)}</span>
                {u.top_genres && u.top_genres.length > 0 && (
                  <span className="ml-2 hidden shrink-0 text-[11px] text-muted sm:inline">
                    {u.top_genres.slice(0, 2).join(", ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UserPicker;
