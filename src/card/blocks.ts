import { nameOf, prLabel, teamsLabel } from './labels';
import type { Card, PrRecord, ReviewStatus } from '../core/types';

export const ACTION_TAKE = 'take';
export const ACTION_REASSIGN = 'reassign';
export const ACTION_OPEN = 'open';

const STATUS: Record<ReviewStatus, string> = {
	pending: '',
	approved: ' (approved)',
	changes_requested: ' (changes requested)',
	commented: ' (commented)',
};

const count = (n: number) => n.toLocaleString('en-US');

export function buildCard(record: PrRecord, appId: string, showRepo = false): Card {
	const blockId = `pr:${record.number}`;
	const author = record.authorRcUsername ? `@${record.authorRcUsername}` : record.authorLogin;
	const state = record.state === 'open' ? '' : ` · ${record.state === 'stopped' ? 'not tracked' : record.state}`;
	const ref = showRepo ? prLabel(record.repo, record.number) : `#${record.number}`;
	const head = `*[${ref} ${record.title}](${record.url})*\nby ${author} · +${count(record.additions)} −${count(record.deletions)}${state}`;

	const teamLines = [
		...record.reviewers.flatMap((r) => (r.teams ?? []).map((team) => ({ label: team, text: `${nameOf(r)}${STATUS[r.status]}` }))),
		...record.unfilledSlots.map((slot) => ({ label: teamsLabel(slot.teams), text: 'no reviewer' })),
	].sort((a, b) => a.label.localeCompare(b.label));
	const others = record.reviewers.filter((r) => !r.teams?.length).map((r) => `${nameOf(r)}${STATUS[r.status]}`);
	const entries = [
		...new Set(teamLines.map((line) => `\`${line.label}\` ${line.text}`)),
		...(others.length ? [`Other reviewers: ${others.join(', ')}`] : []),
	];

	const blocks: unknown[] = [
		{
			type: 'info_card',
			appId,
			blockId,
			rows: [
				{
					background: 'default',
					elements: [{ type: 'mrkdwn', text: head }],
					action: {
						type: 'icon_button',
						icon: { type: 'icon', icon: 'arrow-forward', variant: 'default' },
						label: 'Open PR',
						url: record.url,
						actionId: ACTION_OPEN,
						blockId,
						appId,
					},
				},
				{ background: 'secondary', elements: [{ type: 'mrkdwn', text: entries.join('\n\n') }] },
			],
		},
	];

	if (record.state === 'open') {
		const button = (actionId: string, text: string, style?: 'primary') => ({
			type: 'button',
			text: { type: 'plain_text', text },
			...(style && { style }),
			value: String(record.number),
			actionId,
			blockId,
			appId,
		});
		blocks.push({
			type: 'actions',
			appId,
			blockId,
			elements: [button(ACTION_TAKE, 'Take it', 'primary'), button(ACTION_REASSIGN, 'Reassign')],
		});
	}

	const text = record.reviewers
		.filter((reviewer) => reviewer.rcUsername)
		.map((reviewer) => `@${reviewer.rcUsername}`)
		.join(' ');
	return { text, blocks };
}
