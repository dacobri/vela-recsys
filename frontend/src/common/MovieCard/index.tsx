import { Link } from "react-router-dom";
import { FaYoutube } from "react-icons/fa";
import { useMediaQuery } from "usehooks-ts";

import Image from "../Image";
import { IMovie } from "@/types";
import { cn, imageUrl } from "@/utils/helper";

const MovieCard = ({
  movie,
  category,
}: {
  movie: IMovie;
  category: string;
}) => {
  const { poster_path, original_title: title, name, id, score, reason } = movie;
  const isMobile = useMediaQuery("(max-width: 380px)");
  const hasScore = typeof score === "number" && !Number.isNaN(score);

  return (
    <>
      <Link
        to={`/${category}/${id}`}
        className="bg-surface border border-border rounded-lg relative group w-[170px] select-none xs:h-[250px] h-[216px] overflow-hidden"
      >
        <Image
          height={!isMobile ? 250 : 216}
          width={170}
          src={imageUrl(poster_path)}
          alt={title || name || "movie poster"}
          className="object-cover rounded-lg drop-shadow-md shadow-md group-hover:shadow-none group-hover:drop-shadow-none transition-all duration-300 ease-in-out"
          effect="zoomIn"
        />

        {hasScore && (
          <div className="absolute top-2 left-2 z-[2] rounded-full bg-accent text-accent-text text-[11px] font-bold px-2 py-[2px] shadow-glow">
            {score!.toFixed(2)}
          </div>
        )}

        <div className="absolute top-0 left-0 w-[170px] h-full group-hover:opacity-100 opacity-0 bg-[rgba(11,10,18,0.72)] transition-all duration-300 rounded-lg flex flex-col items-center justify-center gap-3 p-3 text-center">
          <div className="text-[42px] text-accent scale-[0.4] group-hover:scale-100 transition-all duration-300">
            <FaYoutube />
          </div>
          {reason && (
            <p className="text-[11.5px] leading-snug text-gray-200 line-clamp-4">
              <span className="text-accent font-semibold">Why: </span>
              {reason}
            </p>
          )}
        </div>
      </Link>

      <h4
        className={cn(
          "text-gray-200 text-center cursor-default sm:text-base xs:text-[14.75px] text-[14px] font-medium"
        )}
      >
        {(title?.length > 50 ? title.split(":")[0] : title) || name}
      </h4>
    </>
  );
};

export default MovieCard;
