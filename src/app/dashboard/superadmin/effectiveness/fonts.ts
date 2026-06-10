import { IBM_Plex_Mono, Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const fontUI = inter.style.fontFamily;
export const fontNum = ibmPlexMono.style.fontFamily;
