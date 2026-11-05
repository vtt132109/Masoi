import {
  Apple,
  Bird,
  Bug,
  Carrot,
  Cat,
  Cherry,
  Dog,
  Feather,
  Fish,
  Flower2,
  Leaf,
  Mountain,
  Rabbit,
  Rat,
  Shrimp,
  Snail,
  Sprout,
  Squirrel,
  TreePine,
  Turtle,
  Wheat,
  Worm,
  Bean,
  Egg,
  type LucideIcon,
} from 'lucide-react';

/** 24 hình đại diện: icon + màu pastel (dùng được ở cả bộ màu đêm lẫn ngày). */
export const AVATAR_ICONS: LucideIcon[] = [
  Cat,
  Dog,
  Bird,
  Fish,
  Rabbit,
  Squirrel,
  Turtle,
  Snail,
  Bug,
  Rat,
  Worm,
  Shrimp,
  Feather,
  Flower2,
  TreePine,
  Leaf,
  Mountain,
  Cherry,
  Apple,
  Sprout,
  Carrot,
  Wheat,
  Bean,
  Egg,
];

export const AVATAR_COLORS = [
  '#8FA8D8',
  '#D8A48F',
  '#9FD0B5',
  '#D6C27A',
  '#C3A3E0',
  '#E0A3BF',
  '#9EC9D9',
  '#D9B38C',
  '#B5C78F',
  '#A9B0C9',
  '#E3B7A0',
  '#A5D4C7',
];

export const AVATAR_COUNT = AVATAR_ICONS.length;

export const avatarColor = (i: number): string =>
  AVATAR_COLORS[i % AVATAR_COLORS.length] ?? '#A9B0C9';
export const avatarIcon = (i: number): LucideIcon => AVATAR_ICONS[i % AVATAR_ICONS.length] ?? Cat;
