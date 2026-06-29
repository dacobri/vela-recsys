import { FC, ReactNode } from "react";
import { IconType } from "react-icons";

import { pageSubtitle, pageTitle } from "@/styles";

interface PageHeaderProps {
  icon?: IconType;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

const PageHeader: FC<PageHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  children,
}) => (
  <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-accent text-[20px]">
            <Icon />
          </span>
        )}
        <h1 className={pageTitle}>{title}</h1>
      </div>
      {subtitle && <p className={pageSubtitle}>{subtitle}</p>}
    </div>
    {children && <div className="flex items-center gap-3">{children}</div>}
  </header>
);

export default PageHeader;
