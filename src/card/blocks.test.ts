import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parse } from '@rocket.chat/message-parser';

import { ACTION_OPEN, ACTION_REASSIGN, ACTION_TAKE, buildCard } from './blocks';
import type { PrRecord, Reviewer } from '../core/types';

const backend = { pattern: '/apps/meteor/server', teams: ['backend'] };
const frontend = { pattern: '/apps/meteor/client/', teams: ['frontend'] };
const alice: Reviewer = {
	ghLogin: 'alice-gh',
	rcUsername: 'alice',
	rcUserId: 'k1',
	slots: [backend],
	teams: ['backend'],
	status: 'pending',
};
const bob: Reviewer = { ghLogin: 'bob-gh', slots: [frontend], teams: ['frontend'], status: 'pending' };
const url = 'https://github.com/RocketChat/Rocket.Chat/pull/1234';
const record = (over: Partial<PrRecord> = {}): PrRecord => ({
	number: 1234,
	title: 'fix: keep the unread badge in threads',
	url,
	repo: 'RocketChat/Rocket.Chat',
	additions: 42,
	deletions: 8,
	authorLogin: 'dana-gh',
	authorRcUsername: 'dana.lee',
	state: 'open',
	reviewers: [alice, bob],
	unfilledSlots: [],
	requestedBy: 'u1',
	roomId: 'r1',
	cardMessageId: 'm1',
	...over,
});

type Row = { background: string; elements: { type: string; text: string }[]; action?: Record<string, unknown> };
const infoCard = (r: PrRecord) => buildCard(r, 'app').blocks[0] as { type: string; rows: Row[]; blockId: string; appId: string };
const row = (r: PrRecord, i: number) => infoCard(r).rows[i].elements[0].text;

test('text mentions only linked reviewers', () => {
	assert.equal(buildCard(record(), 'app').text, '@alice');
});

test('row 1 has the title link, the author, the diff and an arrow button to the PR', () => {
	const card = infoCard(record());
	assert.equal(card.type, 'info_card');
	assert.equal(card.blockId, 'pr:1234');
	assert.equal(card.appId, 'app');
	assert.equal(card.rows[0].background, 'default');
	assert.equal(card.rows[0].elements[0].type, 'mrkdwn');
	assert.match(
		row(record(), 0),
		/\[#1234 fix: keep the unread badge in threads\]\(https:\/\/github\.com\/RocketChat\/Rocket\.Chat\/pull\/1234\)/,
	);
	assert.match(row(record(), 0), /by @dana\.lee · \+42 −8/);
	assert.deepEqual(card.rows[0].action, {
		type: 'icon_button',
		icon: { type: 'icon', icon: 'arrow-forward', variant: 'default' },
		label: 'Open PR',
		url,
		actionId: ACTION_OPEN,
		blockId: 'pr:1234',
		appId: 'app',
	});
});

test('author shows as the GitHub login when not linked', () => {
	assert.match(row(record({ authorRcUsername: undefined }), 0), /by dana-gh ·/);
});

test('row 2 shows one line per team, plain login when unlinked', () => {
	assert.equal(infoCard(record()).rows[1].background, 'secondary');
	assert.equal(row(record(), 1), '`backend` @alice\n\n`frontend` bob-gh');
});

test('nothing while pending, then the status in words after reviews', () => {
	const reviewed = record({
		reviewers: [
			{ ...alice, status: 'approved' },
			{ ...bob, status: 'changes_requested' },
			{ ghLogin: 'x', rcUsername: 'x', status: 'commented' },
		],
	});
	assert.equal(row(reviewed, 1), '`backend` @alice (approved)\n\n`frontend` bob-gh (changes requested)\n\nOther reviewers: @x (commented)');
});

test('unfilled slot shows "no reviewer"', () => {
	assert.equal(row(record({ reviewers: [alice], unfilledSlots: [frontend] }), 1), '`backend` @alice\n\n`frontend` no reviewer');
});

test('open card has an actions block with Take it and Reassign', () => {
	const actions = buildCard(record(), 'app').blocks[1] as { type: string; elements: Record<string, unknown>[] };
	assert.equal(actions.type, 'actions');
	assert.deepEqual(
		actions.elements.map((e) => [e.actionId, (e.text as { text: string }).text, e.style, e.value]),
		[
			[ACTION_TAKE, 'Take it', 'primary', '1234'],
			[ACTION_REASSIGN, 'Reassign', undefined, '1234'],
		],
	);
});

test('merged and closed cards say so and have no actions block', () => {
	for (const state of ['merged', 'closed'] as const) {
		const card = buildCard(record({ state }), 'app');
		assert.equal(card.blocks.length, 1);
		assert.match(row(record({ state }), 0), new RegExp(`· ${state}$`));
	}
});

test('title renders as one plain link label in Rocket.Chat', () => {
	const title = 'fix: users.update [NEW] *a* `c` #1 lastMessage_ts';
	const [paragraph] = parse(row(record({ title }), 0)) as { value: { value: { value: { label: unknown } }[] }[] }[];
	assert.deepEqual(paragraph.value[0].value[0].value.label, [{ type: 'PLAIN_TEXT', value: `#1234 ${title}` }]);
});

test('the repo name shows before the number when several repos are watched', () => {
	const head = (buildCard(record(), 'app', true).blocks[0] as { rows: Row[] }).rows[0].elements[0].text;
	assert.match(head, /^\*\[Rocket\.Chat#1234 fix/);
});

test('team lines are sorted by team name, named reviewers last', () => {
	const architecture = { pattern: '/packages/models', teams: ['architecture'] };
	const sorted = record({
		reviewers: [{ rcUsername: 'named', status: 'pending' }, bob, { ...alice, slots: [architecture], teams: ['architecture'] }],
		unfilledSlots: [backend],
	});
	assert.equal(row(sorted, 1), '`architecture` @alice\n\n`backend` no reviewer\n\n`frontend` bob-gh\n\nOther reviewers: @named');
});

test('a team with several empty CODEOWNERS lines shows one line', () => {
	const omni = (pattern: string) => ({ pattern, teams: ['omnichannel'] });
	const card = record({ reviewers: [alice], unfilledSlots: [omni('/a'), omni('/b'), omni('/c')] });
	assert.equal(row(card, 1), '`backend` @alice\n\n`omnichannel` no reviewer');
});

test('reviewers outside the teams share one "Other reviewers" line', () => {
	const others = record({
		reviewers: [alice, { rcUsername: 'bob', status: 'approved' }, { rcUsername: 'admin', status: 'pending' }],
	});
	assert.equal(row(others, 1), '`backend` @alice\n\nOther reviewers: @bob (approved), @admin');
});

test('a stopped card says it is not tracked and has no buttons', () => {
	const card = buildCard(record({ state: 'stopped' }), 'app');
	assert.equal(card.blocks.length, 1);
	assert.match(row(record({ state: 'stopped' }), 0), /· not tracked$/);
});

test('big diff counts use thousands separators and are not parsed as a phone link', () => {
	const head = row(record({ additions: 99775, deletions: 31853 }), 0);
	assert.match(head, /\+99,775 −31,853/);
	const [paragraph] = parse(head.split('\n')[1]) as { value: { type: string }[] }[];
	assert.ok(!paragraph.value.some((n) => n.type === 'LINK'));
});
