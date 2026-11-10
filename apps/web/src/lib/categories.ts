// How a category looks: its icon and color names (from the API's `categoryIcons` / `categoryColors`)
// mapped to lucide components and theme classes. Used by `CategoryIcon` and the category editor.
import {
  Baby,
  Beer,
  BedDouble,
  Book,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Music,
  PartyPopper,
  PawPrint,
  Pill,
  Pizza,
  Plane,
  Shapes,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Sun,
  Ticket,
  TreePine,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { categoryColors, categoryIcons } from '@kachingga/api/schemas';

export type CategoryIconName = (typeof categoryIcons)[number];
export type CategoryColor = (typeof categoryColors)[number];

/** Every icon a category can have (`categoryIcons` in the API): the name → its lucide component. */
export const CATEGORY_ICONS: Record<CategoryIconName, typeof Utensils> = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  car: Car,
  'bed-double': BedDouble,
  'party-popper': PartyPopper,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  shapes: Shapes,
  fuel: Fuel,
  plane: Plane,
  bus: Bus,
  home: Home,
  gift: Gift,
  heart: Heart,
  coffee: Coffee,
  beer: Beer,
  pizza: Pizza,
  shirt: Shirt,
  'gamepad-2': Gamepad2,
  music: Music,
  film: Film,
  ticket: Ticket,
  dumbbell: Dumbbell,
  'paw-print': PawPrint,
  baby: Baby,
  'graduation-cap': GraduationCap,
  stethoscope: Stethoscope,
  pill: Pill,
  wifi: Wifi,
  smartphone: Smartphone,
  book: Book,
  briefcase: Briefcase,
  wrench: Wrench,
  'tree-pine': TreePine,
  sun: Sun,
  wallet: Wallet,
};

/**
 * Every color a category can have (`categoryColors` in the API): its soft background and the color
 * itself for the icon (`--cat-*` / `--cat-*-soft` in index.css, AA contrast in light and dark).
 * Full class names so Tailwind sees them.
 */
export const CATEGORY_COLORS: Record<CategoryColor, string> = {
  tomato: 'bg-cat-tomato-soft text-cat-tomato',
  tangerine: 'bg-cat-tangerine-soft text-cat-tangerine',
  mango: 'bg-cat-mango-soft text-cat-mango',
  lime: 'bg-cat-lime-soft text-cat-lime',
  mint: 'bg-cat-mint-soft text-cat-mint',
  teal: 'bg-cat-teal-soft text-cat-teal',
  sky: 'bg-cat-sky-soft text-cat-sky',
  indigo: 'bg-cat-indigo-soft text-cat-indigo',
  grape: 'bg-cat-grape-soft text-cat-grape',
  raspberry: 'bg-cat-raspberry-soft text-cat-raspberry',
  pink: 'bg-cat-pink-soft text-cat-pink',
  cocoa: 'bg-cat-cocoa-soft text-cat-cocoa',
};
