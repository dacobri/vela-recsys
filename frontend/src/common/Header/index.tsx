import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AiOutlineMenu } from "react-icons/ai";
import throttle from "lodash.throttle";

import { Logo } from "..";
import HeaderNavItem from "./HeaderNavItem";
import LabMenu from "./LabMenu";
import TasteButton from "./TasteButton";

import { useGlobalContext } from "@/context/globalContext";
import { maxWidth, textColor } from "@/styles";
import { consumerLinks } from "@/constants";
import { THROTTLE_DELAY } from "@/utils/config";
import { cn } from "@/utils/helper";

const Header = () => {
  const { setShowSidebar } = useGlobalContext();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [isNotFoundPage, setIsNotFoundPage] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    const handleBackgroundChange = () => {
      const body = document.body;
      if (
        window.scrollY > 0 ||
        (body.classList.contains("no-scroll") &&
          parseFloat(body.style.top) * -1 > 0)
      ) {
        setIsActive(true);
      } else {
        setIsActive(false);
      }
    };

    const throttledHandleBackgroundChange = throttle(
      handleBackgroundChange,
      THROTTLE_DELAY
    );

    window.addEventListener("scroll", throttledHandleBackgroundChange);

    return () => {
      window.removeEventListener("scroll", throttledHandleBackgroundChange);
    };
  }, []);

  useEffect(() => {
    if (location.pathname.split("/").length > 3) {
      setIsNotFoundPage(true);
    } else {
      setIsNotFoundPage(false);
    }
  }, [location.pathname]);

  return (
    <header
      className={cn(
        `md:py-[16px] py-[14.5px] fixed top-0 left-0 w-full z-10 transition-all duration-300`,
        isActive ? "header-bg--dark" : ""
      )}
    >
      <nav
        className={cn(maxWidth, `flex justify-between flex-row items-center`)}
      >
        <Logo
          logoColor={cn(isNotFoundPage || isActive ? "text-primary" : "text-primary")}
        />

        <div className="hidden lg:flex flex-row gap-6 items-center text-navColor">
          <ul className="flex flex-row items-center gap-6 capitalize text-[14.25px] font-medium">
            {consumerLinks.map((link) => {
              return (
                <HeaderNavItem
                  key={link.title}
                  link={link}
                  isNotFoundPage={isNotFoundPage}
                  showBg={isActive}
                />
              );
            })}
            <LabMenu />
          </ul>
          <TasteButton />
        </div>

        <button
          type="button"
          name="menu"
          aria-label="Open menu"
          className={cn(
            `inline-block text-[22.75px] lg:hidden transition-all duration-300`,
            isNotFoundPage || isActive
              ? `${textColor} hover:text-accent`
              : `text-primary hover:text-accent`
          )}
          onClick={() => setShowSidebar(true)}
        >
          <AiOutlineMenu />
        </button>
      </nav>
    </header>
  );
};

export default Header;
