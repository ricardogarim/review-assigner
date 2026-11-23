import type { ILogger } from '@rocket.chat/apps-engine/definition/accessors';

import { drawReviewers } from './draw';
import type { Pick } from './draw';
import type { Settings } from '../core/settings';
import type { Store } from '../core/store';
import type { Reviewer, Slot } from '../core/types';
import { unique } from '../core/utils';
import { GitHubError } from '../github/client';
import type { GitHub } from '../github/client';
import { openLoad } from '../github/status';

export type TeamMembers = Record<string, string[]>;

export async function teamMembers(gh: GitHub, slots: Slot[], logger: ILogger): Promise<TeamMembers> {
	const members: TeamMembers = {};
	for (const team of unique(slots.flatMap((slot) => slot.teams))) {
		try {
			members[team] = await gh.teamMembers(team);
		} catch (error) {
			if (!(error instanceof GitHubError)) {
				throw error;
			}
			logger.warn(`Cannot read members of ${team}: ${error.message}`);
			members[team] = [];
		}
	}
	return members;
}

async function reviewersFromPicks(store: Store, picks: Pick[], members: TeamMembers): Promise<Reviewer[]> {
	return Promise.all(
		picks.map(async (pick): Promise<Reviewer> => {
			const link = await store.getLinkByGh(pick.login);
			const teams = unique(pick.slots.flatMap((slot) => slot.teams.filter((team) => members[team]?.includes(pick.login))));
			return { ghLogin: pick.login, rcUserId: link?.rcUserId, rcUsername: link?.rcUsername, slots: pick.slots, teams, status: 'pending' };
		}),
	);
}

export type Drawn = { reviewers: Reviewer[]; unfilled: Slot[] };

export async function drawFor(store: Store, gh: GitHub, s: Settings, slots: Slot[], exclude: string[], logger: ILogger): Promise<Drawn> {
	const members = await teamMembers(gh, slots, logger);
	const lastPicked: Record<string, string[]> = {};
	for (const slot of slots) {
		lastPicked[slot.teams[0]] = await store.lastPicked(slot.teams[0]);
	}
	const result = drawReviewers({
		slots,
		members,
		exclude: [...exclude, ...(await store.inactiveGhLogins()), ...s.notAvailable],
		groupTeams: s.groupTeams,
		strategy: s.strategy,
		load: openLoad(await store.listOpenPrs()),
		lastPicked,
		random: Math.random,
	});
	for (const pick of result.picks) {
		for (const slot of pick.slots) {
			await store.pushLastPicked(slot.teams[0], pick.login);
		}
	}
	return { reviewers: await reviewersFromPicks(store, result.picks, members), unfilled: result.unfilled };
}
