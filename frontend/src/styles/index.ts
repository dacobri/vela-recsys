export const maxWidth = "max-w-[1140px] mx-auto md:px-8 sm:px-6 px-4 xl:px-0";
export const smallMaxWidth =
  "max-w-[940px] mx-auto md:px-8 sm:px-6 px-4 xl:px-0";

export const listItem =
  "flex flex-row gap-3 py-[7px] px-[10px] items-center w-full rounded-lg text-muted hover:text-primary hover:bg-surface-2 transition-all duration-300 font-medium ";

export const sideBarHeading =
  "xs:mb-[6px] mb-1 font-semibold text-[15.75px] text-primary";

export const activeListItem = "text-accent bg-surface-2 font-semibold";

export const watchBtn =
  "sm:text-base xs:text-[14.75px] text-[13.75px] xs:py-2 py-[6px] sm:px-6 xs:px-5 px-[18px] hover:-translate-y-[2px] transition-all duration-300 active:translate-y-[1px] rounded-full font-medium";

export const mainHeading = `sm:text-4xl xs:text-3xl text-[28.75px] font-extrabold sm:leading-[1.2] xs:leading-normal leading-snug text-primary sm:max-w-[420px] xs:max-w-[320px] max-w-[280px]`;

export const paragraph = `sm:text-base xs:text-[15.75px] text-[14.25px] leading-relaxed text-gray-300`;

// `textColor` is used by template chrome as the "emphasis" color -> Vela gold.
export const textColor = "text-accent";

// ── shared Vela page helpers ─────────────────────────────────────────────────
export const pageWrapper = `${maxWidth} pt-28 sm:pt-32 pb-20 min-h-screen`;

export const pageTitle =
  "sm:text-[34px] xs:text-[28px] text-[24px] font-extrabold text-primary tracking-tight";

export const pageSubtitle =
  "mt-2 text-muted sm:text-[15px] text-[14px] max-w-[640px] leading-relaxed";

export const sectionCard = "surface-panel p-5 sm:p-6";

export const accentButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent text-accent-text font-semibold px-5 py-2 text-[14.5px] shadow-glow hover:-translate-y-[2px] active:translate-y-[1px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";

export const ghostButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border text-gray-200 font-medium px-5 py-2 text-[14.5px] hover:border-accent/60 hover:text-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";

export const inputBase =
  "bg-surface border border-border rounded-xl px-4 py-[10px] text-[14.5px] text-primary placeholder:text-muted outline-none focus:border-accent/60 transition-all duration-300";
