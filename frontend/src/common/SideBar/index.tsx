import React, { useCallback } from "react";
import { AnimatePresence, m } from "framer-motion";

import { Link } from "react-router-dom";
import { LuHeart, LuSparkles } from "react-icons/lu";

import SidebarNavItem from "./SidebarNavItem";
import Logo from "../Logo";
import Overlay from "../Overlay";

import { useGlobalContext } from "@/context/globalContext";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { useMotion } from "@/hooks/useMotion";
import { useProfile } from "@/hooks/useProfile";
import { consumerLinks, labGroup, labLinks } from "@/constants";
import { sideBarHeading } from "@/styles";
import { INavLink } from "@/types";

const SideBar: React.FC = () => {
  const { showSidebar, setShowSidebar } = useGlobalContext();
  const { slideIn } = useMotion();
  const { ratings } = useProfile();
  const tasteCount = ratings.length;
  const LabIcon = labGroup.icon;

  const closeSideBar = useCallback(() => {
    setShowSidebar(false);
  }, [setShowSidebar]);

  const { ref } = useOnClickOutside({
    action: closeSideBar,
    enable: showSidebar,
  });

  return (
    <AnimatePresence>
      {showSidebar && (
        <Overlay>
          <m.nav
            variants={slideIn("right", "tween", 0, 0.3)}
            initial="hidden"
            animate="show"
            exit="hidden"
            ref={ref}
            className="dark-glass fixed top-0 right-0 sm:w-[300px] xs:w-[240px] w-[210px] h-full z-[25] overflow-y-auto shadow-md lg:hidden p-4 pb-0 text-gray-200"
          >
            <div className="flex items-center justify-center">
              <Logo />
            </div>

            <div className="p-4 sm:pt-8 xs:pt-6 pt-[22px] h-full flex flex-col">
              {/* Taste affordance (consumer profile) */}
              <Link
                to="/welcome"
                onClick={closeSideBar}
                className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-[10px] text-[13.5px] transition-colors hover:border-accent/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  {tasteCount > 0 ? <LuHeart /> : <LuSparkles />}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold text-primary">
                    {tasteCount > 0 ? "Refine your taste" : "Build your taste"}
                  </span>
                  <span className="text-[11.5px] text-muted">
                    {tasteCount > 0
                      ? `${tasteCount} title${tasteCount === 1 ? "" : "s"} loved`
                      : "Pick films you love"}
                  </span>
                </span>
              </Link>

              <h3 className={sideBarHeading}>Discover</h3>
              <ul className="mb-4 flex flex-col sm:gap-2 xs:gap-[6px] gap-1 capitalize xs:text-[14px] text-[13.5px] font-medium">
                {consumerLinks.map((link: INavLink) => (
                  <SidebarNavItem
                    link={link}
                    closeSideBar={closeSideBar}
                    key={link.title.replaceAll(" ", "")}
                  />
                ))}
              </ul>

              <h3 className={sideBarHeading}>
                <span className="flex items-center gap-2">
                  <LabIcon className="text-accent text-[16px]" />
                  {labGroup.label}
                  <span className="text-[11px] font-normal normal-case text-muted">
                    · {labGroup.caption}
                  </span>
                </span>
              </h3>
              <ul className="flex flex-col sm:gap-2 xs:gap-[6px] gap-1 capitalize xs:text-[14px] text-[13.5px] font-medium">
                {labLinks.map((link: INavLink) => (
                  <SidebarNavItem
                    link={link}
                    closeSideBar={closeSideBar}
                    key={link.title.replaceAll(" ", "")}
                  />
                ))}
              </ul>

              <p className="xs:text-[12px] text-[11.75px] mt-auto sm:mb-6 mb-[20px] text-center text-muted">
                &copy; 2026 Vela. All rights reserved.
              </p>
            </div>
          </m.nav>
        </Overlay>
      )}{" "}
    </AnimatePresence>
  );
};

export default SideBar;
