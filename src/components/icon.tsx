export function Icon({
  name,
  size = 20,
}: {
  name:
    | "pulse"
    | "grid"
    | "database"
    | "shield"
    | "arrow"
    | "upload"
    | "spark"
    | "file"
    | "menu"
    | "clock"
    | "heart" | "home" | "hospital" | "calendar" | "chevron"
    | "info" | "people" | "clipboard" | "bars" | "play" | "sliders" | "download" | "warning" | "ai" | "settings" | "stethoscope" | "trend";
  size?: number;
}) {
  const paths = {
    warning: "M10.3 3.5a2 2 0 0 1 3.4 0L22 19a2 2 0 0 1-1.7 3H3.7A2 2 0 0 1 2 19z M12 8v6 M12 18v.1",
    ai: "M8 3V1 M16 3V1 M8 23v-2 M16 23v-2 M3 8H1 M3 16H1 M23 8h-2 M23 16h-2 M6 3h12l3 3v12l-3 3H6l-3-3V6z M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z",
    settings: "m9 2-1 3-3 1-3 3 2 3-2 3 3 3 3 1 1 3h6l1-3 3-1 3-3-2-3 2-3-3-3-3-1-1-3z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    stethoscope: "M4 3H2v6a5 5 0 0 0 10 0V3h-2 M7 14v3a5 5 0 0 0 10 0v-3 M20 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M4 2v3 M10 2v3",
    trend: "M2 20 9 11l5 4 8-12 M16 3h6v6",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-9.6a5.5 5.5 0 0 0 0-7.8Z",
    home: "M2 10 12 2l10 8 M5 9v12h5v-7h4v7h5V9",
    hospital: "M8 21V3h8v18 M3 21V9h5 M16 9h5v12 M10 7h4 M12 5v4 M11 21v-5h2v5 M5 12v2 M19 12v2",
    calendar: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 11h16 M8 15h2 M14 15h2",
    chevron: "m5 9 7 7 7-7",
    info: "M12 11v6 M12 7v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    people: "M16 21v-3c0-5-12-5-12 0v3h12 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M19 14c3 0 4 2 4 4v3h-4",
    clipboard: "M9 4H5v18h14V4h-4 M9 2h6v5H9z M8 12l1 1 2-3 M13 12h3 M8 17l1 1 2-3 M13 17h3",
    bars: "M3 21V12h4v9 M10 21V7h4v14 M17 21V2h4v19 M2 21h20",
    play: "m6 3 15 9-15 9z",
    sliders: "M3 6h7 M14 6h7 M3 12h11 M18 12h3 M3 18h3 M10 18h11 M10 4h4v4h-4z M14 10h4v4h-4z M6 16h4v4H6z",
    download: "M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5",
    pulse: "M2 12h5l3-8 4 16 3-8h5",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    database:
      "M4 6c0-4 16-4 16 0s-16 4-16 0v12c0 4 16 4 16 0V6 M4 12c0 4 16 4 16 0",
    shield: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
    spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
    file: "M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h8",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} fill={name === "heart" ? "currentColor" : "none"} />
      {name === "heart" && <path d="M2 12h5l2-5 4 11 3-6h6" stroke="#102750" strokeWidth="1.5" />}
    </svg>
  );
}
