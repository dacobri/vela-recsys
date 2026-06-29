import { Link } from "react-router-dom";

import img from "@/assets/svg/not-found.svg";
import { accentButton } from "@/styles";

const NotFound = () => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col gap-2 items-center text-center">
        <img
          src={img}
          alt="not found"
          className="lg:max-h-[340px] xs:max-h-[240px] max-h-[170px] w-full opacity-90"
        />
        <h3 className="sm:text-2xl xs:text-xl text-lg mt-2 text-primary font-semibold">
          Lost in the constellation
        </h3>
        <p className="sm:text-[16px] text-[14px] text-muted">
          We can't seem to find the page you're looking for.
        </p>
        <Link to="/" className={`${accentButton} mt-4`}>
          Back to home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
