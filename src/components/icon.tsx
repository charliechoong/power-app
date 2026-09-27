import type { CSSProperties } from "react";
type Name =
  | "spark"
  | "book"
  | "quote"
  | "plus"
  | "search"
  | "arrow"
  | "download"
  | "edit"
  | "trash"
  | "check"
  | "device";
const paths: Record<Name, React.ReactNode> = {
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm9 3a3 3 0 0 1 3-3h5v15h-5a3 3 0 0 0-3 2" />
    </>
  ),
  quote: (
    <>
      <circle cx="6.5" cy="8" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="8" r="3.5" fill="currentColor" stroke="none" />
      <path d="M10 8c0 5-2 8-6 10M21 8c0 5-2 8-6 10" strokeWidth="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  edit: <path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14v6Z" />,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  check: <path d="m5 12 4 4L19 6" />,
  device: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: Name;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
