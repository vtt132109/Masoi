import {
  Crosshair,
  Eye,
  FlaskConical,
  PawPrint,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_TEAM, type RoleId, type Team } from '@masoi/shared';

export const ROLE_ICON: Record<RoleId, LucideIcon> = {
  VILLAGER: Users,
  WEREWOLF: PawPrint,
  SEER: Eye,
  GUARD: Shield,
  WITCH: FlaskConical,
  HUNTER: Crosshair,
};

/** Thứ tự hiển thị các vai trong bảng cấu hình. */
export const ROLE_ORDER: RoleId[] = ['WEREWOLF', 'VILLAGER', 'SEER', 'GUARD', 'WITCH', 'HUNTER'];

export function teamColorClass(team: Team): {
  text: string;
  bg: string;
  border: string;
  soft: string;
} {
  return team === 'WOLF'
    ? { text: 'text-wolf', bg: 'bg-wolf', border: 'border-wolf', soft: 'bg-wolf/15' }
    : { text: 'text-village', bg: 'bg-village', border: 'border-village', soft: 'bg-village/15' };
}

export const roleTeam = (role: RoleId): Team => ROLE_TEAM[role];
