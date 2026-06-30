import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LuChevronDown } from "react-icons/lu";

import { labGroup, labLinks } from "@/constants";
import { cn } from "@/utils/helper";

/**
 * Desktop "Lab" dropdown — groups the analytical / transparency pages under one
 * clearly-labelled menu so the consumer nav stays clean while the engine room
 * is one click away. The trigger lights up gold when any Lab route is active.
 */
const LabMenu = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const ref = useRef<HTMLLIElement | null>(null);

  // Self-contained outside-click + Escape handling (mousedown so it doesn't race
  // the trigger's own onClick toggle).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu whenever we navigate to a new route.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const labActive = labLinks.some((l) => location.pathname.startsWith(l.path));
  const TriggerIcon = labGroup.icon;

  return (
    <li className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        onMouseEnter={() => setOpen(true)}
        className={cn(
          "nav-link flex items-center gap-1.5 whitespace-nowrap capitalize",
          labActive || open ? "text-accent" : "text-navColor hover:text-primary"
        )}
      >
        <TriggerIcon className="text-[15px]" />
        {labGroup.label}
        <LuChevronDown
          className={cn(
            "text-[14px] transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="dark-glass absolute right-0 top-[calc(100%+14px)] z-30 w-[260px] overflow-hidden rounded-2xl p-2 shadow-xl"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="text-[12.5px] font-semibold text-primary">
              {labGroup.label}
            </p>
            <p className="text-[11.5px] text-muted">{labGroup.caption}</p>
          </div>
          <ul className="flex flex-col gap-[2px]">
            {labLinks.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.path}>
                  <NavLink
                    to={link.path}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-[9px] text-[13.5px] capitalize transition-colors duration-200",
                        isActive
                          ? "bg-surface-2 font-semibold text-accent"
                          : "text-gray-200 hover:bg-surface-2 hover:text-primary"
                      )
                    }
                  >
                    <Icon className="shrink-0 text-[17px]" />
                    {link.title}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
};

export default LabMenu;
