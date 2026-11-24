import type { IUser } from '@rocket.chat/apps-engine/definition/users';

import type { CardContext } from './context';
import { nameOf, prCode, prLabel, slotLabel } from './labels';
import { isAuthor } from './permissions';
import { saveAndNotify } from '../core/chat';
import { settings } from '../core/settings';
import type { PrRecord, Reviewer, Slot } from '../core/types';
import { sameLogin, unique } from '../core/utils';
import { GitHub } from '../github/client';
import { teamMembers } from '../review/assign';

export const TAKE_PREFIX = 'take:';

export function takeModal(record: PrRecord, teams: string[], preselected: string[], appId: string) {
	const text = (value: string) => ({ type: 'plain_text', text: value });
	const block = (blockId: string) => ({ appId, blockId, actionId: blockId });
	return {
		id: `${TAKE_PREFIX}${record.repo}#${record.number}`,
		title: text(`Take ${prLabel(record.repo, record.number)}`),
		blocks: [
			{
				type: 'input',
				blockId: 'teams',
				optional: true,
				label: text('Teams you will review for (leave empty to join as an extra reviewer)'),
				element: {
					type: 'multi_static_select',
					...block('teams'),
					placeholder: text('Pick teams'),
					initialValue: preselected,
					options: teams.map((team) => ({ text: text(team), value: team })),
				},
			},
		],
		submit: { type: 'button', text: text('Take it'), ...block('submit') },
		close: { type: 'button', text: text('Cancel'), ...block('close') },
	};
}

export async function take(
	ctx: CardContext,
	record: PrRecord,
	user: IUser,
	chosen?: string[],
): Promise<string | { choose: string[]; preselected: string[] } | undefined> {
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

	const allSlots = [...record.reviewers.flatMap((r) => r.slots ?? []), ...record.unfilledSlots];
	const choices = unique(allSlots.map(slotLabel));
	if (!choices.length) {
		return asExtra();
	}
	const s = await settings(read);
	const members = await teamMembers(new GitHub(http, s.token, record.repo), allSlots, app.getLogger());
	const inTeam = (login: string | undefined, team: string) => !!login && !!members[team]?.some((m) => sameLogin(m, login));
	const memberOf = (slot: Slot) => slot.teams.some((team) => inTeam(link?.ghLogin, team));
	if (!chosen) {
		return { choose: choices, preselected: unique(allSlots.filter(memberOf).map(slotLabel)) };
	}
	const mine = (slot: Slot) => chosen.includes(slotLabel(slot));

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
		const keptTeams = (reviewer.teams ?? []).filter((team) => kept.some((slot) => slot.teams.includes(team)));
		return kept.length ? [{ ...reviewer, slots: kept, teams: keptTeams }] : [];
	});
	const teams = unique(
		taken.flatMap((slot) => {
			const member = slot.teams.filter((team) => inTeam(link?.ghLogin, team));
			return member.length ? member : slot.teams;
		}),
	);
	const me: Reviewer = { ...taker, slots: taken, teams };
	const from = replaced.length ? ` (from ${replaced.map(nameOf).join(', ')})` : '';
	return save(
		{ ...record, reviewers: [...reviewers, me], unfilledSlots: record.unfilledSlots.filter((slot) => !mine(slot)) },
		`@${user.username} took ${taken.map(slotLabel).join(', ')}${from}`,
	);
}
