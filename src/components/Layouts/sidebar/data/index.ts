import * as Icons from "../icons";
import type { PropsType } from "../icons";

export type NavSubItem = { title: string; url: string };

export type NavItem =
  | {
      title: string;
      icon: (props: PropsType) => React.ReactElement;
      url: string;
    }
  | {
      title: string;
      icon: (props: PropsType) => React.ReactElement;
      items: NavSubItem[];
    };

export type NavSection = { label: string; items: NavItem[] };

export const NAV_DATA: NavSection[] = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Dashboard",
        icon: Icons.HomeIcon,
        url: "/",
      },
    ],
  },
];
