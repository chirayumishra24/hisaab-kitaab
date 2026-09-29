/**
 * HisabKitaab design tokens (source of truth).
 * Web mirrors these as CSS variables in apps/web/app/globals.css;
 * mobile imports them directly.
 *
 * Brand: navy #002C49 and green #00A86B, sampled from the original logo.
 * Green is an accent (primary action + "to receive"), never a background wash.
 */

export const brand = {
  navy: "#002C49",
  navyDeep: "#001B2E",
  green: "#00A86B",
} as const;

export const lightColors = {
  canvas: "#F5F7F6",
  surface: "#FFFFFF",
  surfaceSunken: "#EDF1EF",
  ink: "#15202B",
  body: "#3D4A55",
  muted: "#5F6C76",
  border: "#DDE3E1",
  borderStrong: "#C3CCC9",

  primary: brand.navy,
  onPrimary: "#FFFFFF",
  accent: brand.green,
  /** Text on the green accent must be dark for contrast. */
  onAccent: "#00140C",

  receive: "#00774C",
  receiveSoft: "#E3F4EC",
  pay: "#B42318",
  paySoft: "#FDECEA",
  overdue: "#B54708",
  overdueSoft: "#FEF0C7",
  info: "#1D5C8A",
  infoSoft: "#E4EEF6",

  focus: "#1570EF",
  scrim: "rgba(0, 27, 46, 0.55)",
} as const;

export type ColorTokens = { [K in keyof typeof lightColors]: string };

export const darkColors: ColorTokens = {
  canvas: "#0B1620",
  surface: "#12212D",
  surfaceSunken: "#0E1B25",
  ink: "#EEF3F1",
  body: "#C9D3D0",
  muted: "#93A2AA",
  border: "#223442",
  borderStrong: "#33495A",

  primary: "#E6EEF2",
  onPrimary: "#001B2E",
  accent: "#1FC284",
  onAccent: "#00140C",

  receive: "#3DD598",
  receiveSoft: "#0F3326",
  pay: "#FF8A7A",
  paySoft: "#3A1714",
  overdue: "#FDB022",
  overdueSoft: "#3A2A0B",
  info: "#84B8E0",
  infoSoft: "#142C40",

  focus: "#84ADFF",
  scrim: "rgba(0, 0, 0, 0.6)",
};

/** Avatar tints (background, foreground) chosen per person via avatarTone(). */
export const avatarTones = {
  light: [
    ["#E4EEF6", "#1D4F75"],
    ["#E3F4EC", "#0B6040"],
    ["#FCEBDD", "#8A4210"],
    ["#EEE8F7", "#553C8B"],
    ["#FBE7EE", "#8C2451"],
    ["#E6F1F1", "#1F5E5E"],
  ],
  dark: [
    ["#17344B", "#A9CBEA"],
    ["#12382A", "#8FE0B9"],
    ["#3A2614", "#F5B98A"],
    ["#2A2240", "#C8B6F0"],
    ["#3A1A28", "#F2A5C3"],
    ["#163333", "#98D5D5"],
  ],
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fontSizes = {
  caption: 12,
  small: 14,
  body: 16,
  lead: 18,
  title: 20,
  heading: 24,
  display: 32,
  hero: 40,
} as const;

/** Minimum touch target (px / dp). */
export const TOUCH_TARGET = 48;
