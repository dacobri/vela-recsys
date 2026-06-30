import { NavLink } from "react-router-dom";
import { cn } from "../../utils/helper";

interface HeaderProps {
  link: { title: string; path: string };
  isNotFoundPage: boolean;
  showBg: boolean;
}

const HeaderNavItem = ({ link }: HeaderProps) => {
  return (
    <li>
      <NavLink
        to={link.path}
        className={({ isActive }) => {
          return cn(
            "nav-link whitespace-nowrap",
            isActive
              ? "active text-accent"
              : "text-navColor hover:text-primary"
          );
        }}
        // Exact match only for "/" so Home isn't always-active; section links
        // (e.g. /movie) stay highlighted on their detail pages too.
        end={link.path === "/"}
      >
        {link.title}
      </NavLink>
    </li>
  );
};

export default HeaderNavItem;
