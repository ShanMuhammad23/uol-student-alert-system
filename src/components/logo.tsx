import darkLogo from "@/assets/logos/logo-white.png";
import logo from "@/assets/logos/logo-black.png";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative h-14 w-40">
      <Image
        src={logo}
        fill
        className="dark:hidden"
        alt="UOL | Student Early Alert System logo"
        role="presentation"
        quality={100}
      />

      <Image
        src={darkLogo}
        fill
        className="hidden dark:block"
        alt="UOL | Student Early Alert System logo"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
