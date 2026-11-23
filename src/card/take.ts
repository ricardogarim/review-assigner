import type { IUser } from '@rocket.chat/apps-engine/definition/users';

import type { CardContext } from './context';
import { nameOf, prCode, slotLabel } from './labels';
import { isAuthor } from './permissions';
import { saveAndNotify } from '../core/chat';
import { settings } from '../core/settings';
import type { PrRecord, Reviewer, Slot } from '../core/types';
import { sameLogin, unique } from '../core/utils';
import { GitHub } from '../github/client';
import { teamMembers } from '../review/assign';

export async function take(ctx: CardContext, record: PrRecord, user: IUser): Promise<string | undefined> {
	const { app, read, http, modify, store } = ctx;
	if (record.reviewers.some((r) => r.rcUserId === user.id)) {
		return `You already review ${prCode(record.repo, record.number)}.`;
	}
	if (await isAuthor(record, user, store)) {
		return `You wrote ${prCode(record.repo, record.number)}, so you cannot take its review.`;
	}

	const save = async (next: PrRecord, note: string): Promise<undefined> => {
		await saveAndNotify(next, app.getID(), modify, read, store, note);
		return undefined;
	};
	const link = await store.getLinkByRc(user.id);
	const taker: Reviewer = { ghLogin: link?.ghLogin, rcUserId: user.id, rcUsername: user.username, status: 'pending' };
	const asExtra = () => save({ ...record, reviewers: [...record.reviewers, taker] }, `@${user.username} took a review.`);
	if (!link) {
		return asExtra();
	}

	const s = await settings(read);
	const allSlots = [...record.reviewers.flatMap((r) => r.slots ?? []), ...record.unfilledSlots];
	const members = await teamMembers(new GitHub(http, s.token, record.repo), allSlots, app.getLogger());
	const inTeam = (login: string | undefined, team: string) => !!login && !!members[team]?.some((m) => sameLogin(m, login));
	const mine = (slot: Slot) => slot.teams.some((team) => inTeam(link.ghLogin, team));
	const teamsFor = (login: string | undefined, slots: Slot[]) =>
		unique(slots.flatMap((slot) => slot.teams)).filter((team) => inTeam(login, team));

	const replaced = record.reviewers.filter((r) => (r.slots ?? []).some(mine));
	const taken = [...replaced.flatMap((r) => (r.slots ?? []).filter(mine)), ...record.unfilledSlots.filter(mine)];
	if (!taken.length) {
		return asExtra();
	}
	const reviewers = record.reviewers.flatMap((reviewer) => {
		if (!replaced.includes(reviewer)) {
			return [reviewer];
		}
		const kept = (reviewer.slots ?? []).filter((slot) => !mine(slot));
		return kept.length ? [{ ...reviewer, slots: kept, teams: teamsFor(reviewer.ghLogin, kept) }] : [];
	});
	const me: Reviewer = { ...taker, slots: taken, teams: teamsFor(link.ghLogin, taken) };
	const from = replaced.length ? ` (from ${replaced.map(nameOf).join(', ')})` : '';
	return save(
		{ ...record, reviewers: [...reviewers, me], unfilledSlots: record.unfilledSlots.filter((slot) => !mine(slot)) },
		`@${user.username} took ${taken.map(slotLabel).join(', ')}${from}`,
	);
}
