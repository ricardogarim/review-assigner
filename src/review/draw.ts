import type { Slot } from '../core/types';

export type DrawInput = {
	slots: Slot[];
	members: Record<string, string[]>;
	exclude: string[];
	load: Record<string, number>;
	lastPicked: Record<string, string[]>;
	random: () => number;
	groupTeams?: boolean;
	strategy?: 'balanced' | 'random';
};

export type Pick = {
	login: string;
	slots: Slot[];
};

export function drawReviewers(input: DrawInput): { picks: Pick[]; unfilled: Slot[] } {
	const lower = (login: string) => login.toLowerCase();
	const exclude = new Set(input.exclude.map(lower));
	const load = Object.fromEntries(Object.entries(input.load).map(([login, count]) => [lower(login), count]));
	const membersOf = (slot: Slot) => [...new Set(slot.teams.flatMap((team) => input.members[team] ?? []))];
	const covers = (login: string, slot: Slot) => membersOf(slot).includes(login);

	const ordered = [...input.slots].sort((a, b) => membersOf(a).length - membersOf(b).length);
	const covered = new Set<Slot>();
	const picks: Pick[] = [];
	const unfilled: Slot[] = [];
	const home = new Map<Pick, string[]>();

	for (const slot of ordered) {
		const group = input.groupTeams !== false;
		const existing = picks.find((pick) => covers(pick.login, slot));
		const sameTeam = picks.find((pick) => home.get(pick)?.some((team) => slot.teams.includes(team)));
		const absorb = group ? existing : sameTeam;
		if (absorb) {
			absorb.slots.push(slot);
			covered.add(slot);
			continue;
		}

		const candidates = membersOf(slot).filter((login) => !exclude.has(lower(login)) && !picks.some((pick) => pick.login === login));
		if (!candidates.length) {
			if (existing) {
				existing.slots.push(slot);
				covered.add(slot);
			} else {
				unfilled.push(slot);
			}
			continue;
		}

		const recent = input.lastPicked[slot.teams[0]] ?? [];
		const keyOf = (login: string) =>
			input.strategy === 'random'
				? []
				: [
						load[lower(login)] ?? 0,
						group ? -ordered.filter((other) => !covered.has(other) && covers(login, other)).length : 0,
						recent.includes(login) ? 1 : 0,
					];
		const compare = (a: number[], b: number[]) => a.reduce((diff, value, i) => diff || value - b[i], 0);
		const keyed = candidates.map((login) => ({ login, key: keyOf(login) })).sort((a, b) => compare(a.key, b.key));
		const best = keyed.filter((entry) => compare(entry.key, keyed[0].key) === 0);
		const chosen = best[Math.floor(input.random() * best.length)].login;

		const pick = { login: chosen, slots: [slot] };
		picks.push(pick);
		home.set(
			pick,
			slot.teams.filter((team) => input.members[team]?.includes(chosen)),
		);
		covered.add(slot);
	}

	return { picks, unfilled };
}
