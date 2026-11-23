import type { IUser } from '@rocket.chat/apps-engine/definition/users';

import type { CardContext } from './context';
import { nameOf, prLabel, slotLabel, teamsLabel } from './labels';
import { saveAndNotify } from '../core/chat';
import { settings } from '../core/settings';
import type { PrRecord, Reviewer, Slot } from '../core/types';
import { GitHub } from '../github/client';
import { drawFor } from '../review/assign';
import type { Drawn } from '../review/assign';

export const MODAL_PREFIX = 'reassign:';

type Target = { kind: 'r' | 'u'; index: number; teams?: string[]; slots: Slot[]; label: string };

export type ReassignState = Record<string, Record<string, string | undefined>>;

const targetKey = (target: Target): string => `${target.kind}${target.index}`;

function targets(record: PrRecord): Target[] {
	return [
		...record.reviewers.map((reviewer, index) => ({
			kind: 'r' as const,
			index,
			teams: reviewer.teams,
			slots: reviewer.slots ?? [],
			label: reviewer.teams?.length ? `${teamsLabel(reviewer.teams)}: ${nameOf(reviewer)}` : nameOf(reviewer),
		})),
		...record.unfilledSlots.map((slot, index) => ({
			kind: 'u' as const,
			index,
			teams: slot.teams,
			slots: [slot],
			label: `${slotLabel(slot)}: no reviewer`,
		})),
	];
}

function replace(record: PrRecord, target: Target, { reviewers, unfilled }: Drawn): PrRecord {
	const [first, ...more] = reviewers;
	const kept = target.kind === 'r' ? record.reviewers.map((r, i) => (i === target.index ? first : r)) : [...record.reviewers, first];
	const open = target.kind === 'u' ? record.unfilledSlots.filter((_, i) => i !== target.index) : record.unfilledSlots;
	return { ...record, reviewers: [...kept, ...more], unfilledSlots: [...open, ...unfilled] };
}

export function reassignModal(record: PrRecord, appId: string) {
	const block = (blockId: string) => ({ appId, blockId, actionId: blockId });
	const all = targets(record);
	const text = (value: string) => ({ type: 'plain_text', text: value });
	return {
		id: `${MODAL_PREFIX}${record.repo}#${record.number}`,
		title: text(`Reassign ${prLabel(record.repo, record.number)}`),
		blocks: [
			{
				type: 'input',
				blockId: 'slot',
				label: text('Reviewer to replace'),
				element: {
					type: 'static_select',
					...block('slot'),
					initialValue: all[0] ? targetKey(all[0]) : undefined,
					options: all.map((t) => ({ text: text(t.label), value: targetKey(t) })),
				},
			},
			{
				type: 'input',
				blockId: 'action',
				label: text('Action'),
				element: {
					type: 'static_select',
					...block('action'),
					initialValue: 'replace',
					options: [
						{ text: text('Replace with the person below, or draw again'), value: 'replace' },
						{ text: text('Remove this reviewer'), value: 'remove' },
					],
				},
			},
			{
				type: 'input',
				blockId: 'user',
				optional: true,
				label: text('New reviewer (leave empty to draw again)'),
				element: { type: 'users_select', ...block('user') },
			},
		],
		submit: { type: 'button', text: text('Reassign'), ...block('submit') },
		close: { type: 'button', text: text('Cancel'), ...block('close') },
	};
}

export function reassignTarget(record: PrRecord, state: ReassignState): Target | undefined {
	return targets(record).find((t) => targetKey(t) === state.slot?.slot);
}

async function replacement(ctx: CardContext, record: PrRecord, target: Target, chosen: string | undefined): Promise<Drawn | string> {
	const { app, read, http, store } = ctx;
	if (chosen) {
		const user = (await read.getUserReader().getByUsername(chosen)) ?? (await read.getUserReader().getById(chosen));
		if (!user) {
			return `Unknown user ${chosen}.`;
		}
		const link = await store.getLinkByRc(user.id);
		const reviewer: Reviewer = {
			ghLogin: link?.ghLogin,
			rcUserId: user.id,
			rcUsername: user.username,
			slots: target.slots,
			teams: target.teams,
			status: 'pending',
		};
		return { reviewers: [reviewer], unfilled: [] };
	}
	if (!target.slots.length) {
		return { reviewers: [], unfilled: [] };
	}
	const s = await settings(read);
	const taken = record.reviewers.flatMap((r) => (r.ghLogin ? [r.ghLogin] : []));
	return drawFor(store, new GitHub(http, s.token, record.repo), s, target.slots, [record.authorLogin, ...taken], app.getLogger());
}

export async function submitReassign(
	ctx: CardContext,
	record: PrRecord,
	target: Target,
	state: ReassignState,
	user: IUser,
): Promise<Record<string, string> | undefined> {
	const { app, read, modify, store } = ctx;
	const save = (next: PrRecord, note: string) => saveAndNotify(next, app.getID(), modify, read, store, note);
	const old = target.kind === 'r' ? record.reviewers[target.index] : undefined;

	if (state.action?.action === 'remove') {
		if (!old) {
			return { action: 'This row has no reviewer to remove.' };
		}
		const teams = target.slots.length ? ` (${target.slots.map(slotLabel).join(', ')})` : '';
		await save(
			{
				...record,
				reviewers: record.reviewers.filter((_, i) => i !== target.index),
				unfilledSlots: [...record.unfilledSlots, ...target.slots],
			},
			`@${user.username} removed ${nameOf(old)}${teams}`,
		);
		return undefined;
	}

	const next = await replacement(ctx, record, target, state.user?.user);
	if (typeof next === 'string') {
		return { user: next };
	}
	if (!next.reviewers.length) {
		return { user: 'Nobody else can be drawn. Pick a user.' };
	}
	const label = target.slots.length ? target.slots.map(slotLabel).join(', ') : 'a review';
	await save(
		replace(record, target, next),
		`@${user.username} reassigned ${label} from ${old ? nameOf(old) : 'nobody'} to ${next.reviewers.map(nameOf).join(', ')}`,
	);
	return undefined;
}
