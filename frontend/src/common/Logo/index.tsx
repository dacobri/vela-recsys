import React from "react";
import { Link } from "react-router-dom";

import logo from "@/assets/svg/vela-icon.svg";
import { cn } from "@/utils/helper";

interface logoProps {
  className?: string;
  logoColor?: string;
}

const Logo: React.FC<logoProps> = ({
  className = "",
  logoColor = "text-primary",
}) => (
  <Link
    to="/"
    aria-label="Vela — home"
    className={cn(`flex flex-row items-center xs:gap-2 gap-[6px]`, className)}
  >
    <img
      src={logo}
      alt="Vela"
      className="sm:h-[30px] h-[26px] sm:w-[30px] w-[26px] rounded-[7px]"
    />
    <span
      className={cn(
        logoColor,
        `font-semibold sm:text-[20px] text-[18px] tracking-[0.04em] lowercase`
      )}
    >
      vela
    </span>
  </Link>
);

export default Logo;
