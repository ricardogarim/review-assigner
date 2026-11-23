import type { Reviewer, Slot } from '../core/types';

export const teamsLabel = (teams: string[]): string => teams.join('/');

export const slotLabel = (slot: Slot): string => teamsLabel(slot.teams);

export const nameOf = (reviewer: Reviewer): string => (reviewer.rcUsername ? `@${reviewer.rcUsername}` : (reviewer.ghLogin ?? ''));

export const prLabel = (repo: string, number: number): string => `${repo.split('/')[1]}#${number}`;

// In chat text the parser would read "Rocket.Chat#1" as a link to a domain.
export const prCode = (repo: string, number: number): string => `\`${prLabel(repo, number)}\``;
