import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { GoSearch } from "react-icons/go";

interface SearchProps {
  setQuery: (val: {}) => void;
}

const Search: React.FC<SearchProps> = ({ setQuery }) => {
  const { category } = useParams();
  const [search, setSearch] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search) return;
    setQuery({ search });
    setSearch("");
  };

  return (
    <form
      className="text-[14px] lg:py-10 md:pt-9 md:pb-10 sm:pt-8 sm:pb-10  pt-6 pb-8 flex flex-row items-center justify-center"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        className="py-[10px] pl-[20px] pr-[40px] rounded-full outline-none w-[300px] md:w-[340px] shadow-md transition-all duration-300 bg-surface border border-border text-primary placeholder:text-muted focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/70"
        onChange={(e) => setSearch(e.target.value)}
        value={search}
        placeholder={`Search ${category === "movie" ? "movies" : "tv series"}`}
      />
      <button
        type="submit"
        aria-label="Search"
        className="text-[18px] -ml-[34px] text-accent z-[1]"
      >
        <GoSearch />
      </button>
    </form>
  );
};

export default Search;
