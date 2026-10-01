import type { CSSProperties } from "react";
type Name =
  | "home"
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
  | "device"
  | "heart"
  | "image"
  | "list";
const paths: Record<Name, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
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
  heart: (
    <path d="M20.8 8.6c0 4.2-5.3 8.1-8.8 11-3.5-2.9-8.8-6.8-8.8-11a4.9 4.9 0 0 1 8.8-2.9 4.9 4.9 0 0 1 8.8 2.9Z" />
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 5 5" />
    </>
  ),
  list: (
    <>
      <path d="m4 6 2 2 3-3M4 14l2 2 3-3M12 7h9M12 15h9M4 21h17" />
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
