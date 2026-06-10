import type { PropsWithChildren } from "react";
import { inter, ibmPlexMono } from "./fonts";

export default function EffectivenessLayout({ children }: PropsWithChildren) {
  return (
    <div className={`${inter.className} ${ibmPlexMono.className}`}>
      {children}
    </div>
  );
}
