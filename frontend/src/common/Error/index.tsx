import { BiError } from "react-icons/bi";
import { cn } from "@/utils/helper";

interface ErrorProps {
  className?: string | undefined;
  error: string;
}

const Error = ({ className = "h-screen", error }: ErrorProps) => {
  return (
    <div
      className={cn(
        `relative bg-background top-0 left-0 w-full flex justify-center items-center`,
        className
      )}
    >
      <div className="flex flex-row gap-2 items-center">
        <BiError className="text-accent text-[32px]" />
        <p className="text-gray-300">{error}</p>
      </div>
    </div>
  );
};

export default Error;
