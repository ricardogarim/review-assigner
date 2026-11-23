import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UIKitBlockInteractionContext, UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';

import { onBlockAction, onViewSubmit } from './handlers';
import { fakeEnv } from '../core/fakes';
import { Store } from '../core/store';
import type { PrRecord, Slot } from '../core/types';

const both: Slot = { pattern: '/packages/rest-typings/', teams: ['architecture', 'backend'] };
const users = [
	{ id: 'req', username: 'req' },
	{ id: 'k1', username: 'alice' },
	{ id: 'd1', username: 'bob' },
	{ id: 'a1', username: 'arch' },
	{ id: 'au', username: 'author' },
	{ id: 'x1', username: 'stranger' },
	{ id: 'o1', username: 'old', isEnabled: false },
];
const record = (over: Partial<PrRecord> = {}): PrRecord => ({
	number: 1,
	title: 't',
	url: 'u',
	repo: 'RocketChat/Rocket.Chat',
	additions: 1,
	deletions: 1,
	authorLogin: 'author-gh',
	state: 'open',
	reviewers: [{ ghLogin: 'alice', rcUserId: 'k1', rcUsername: 'alice', teams: ['backend'], slots: [both], status: 'pending' }],
	unfilledSlots: [],
	requestedBy: 'req',
	roomId: 'r1',
	cardMessageId: 'm1',
	...over,
});

async function setup(teams: Record<string, string[]> = {}, pr = record(), extra: Record<string, unknown> = {}) {
	const env = fakeEnv({ users, teams, settings: { user_links: 'arch arch\nauthor author-gh\nalice alice\nold old-gh', ...extra } });
	const store = new Store(env.read, env.persis);
	await store.savePr(pr);
	return { ...env, store };
}

const responder = {
	successResponse: () => ({ success: true }),
	openModalViewResponse: (view: unknown) => ({ view }),
	viewErrorResponse: (error: unknown) => ({ error }),
};
const click = (actionId: string, userId: string) =>
	({
		getInteractionData: () => ({ actionId, user: users.find((u) => u.id === userId), message: { id: 'm1' }, room: { id: 'r1' } }),
		getInteractionResponder: () => responder,
	}) as unknown as UIKitBlockInteractionContext;
const submit = (userId: string, slot: string, username?: string, action?: string) =>
	({
		getInteractionData: () => ({
			user: users.find((u) => u.id === userId),
			view: {
				id: 'reassign:RocketChat/Rocket.Chat#1',
				state: { slot: { slot }, user: { user: username }, ...(action && { action: { action } }) },
			},
		}),
		getInteractionResponder: () => responder,
	}) as unknown as UIKitViewSubmitInteractionContext;

test('Reassign to a picked user reads the username users_select submits', async () => {
	const env = await setup();
	await onViewSubmit(env.app, submit('req', 'r0', 'bob'), env.read, env.http, env.persis, env.modify);
	assert.equal((await env.store.getPr('RocketChat/Rocket.Chat', 1))?.reviewers[0].rcUsername, 'bob');
	assert.equal(env.thread[0], '@req reassigned architecture/backend from @alice to @bob');
});

test('Reassign submitted by someone not allowed changes nothing', async () => {
	const env = await setup();
	await onViewSubmit(env.app, submit('x1', 'r0', 'bob'), env.read, env.http, env.persis, env.modify);
	assert.equal((await env.store.getPr('RocketChat/Rocket.Chat', 1))?.reviewers[0].rcUsername, 'alice');
	assert.match(env.told[0].text, /Only the author, the requester or a current reviewer can reassign/);
});

test('the author cannot take their own PR', async () => {
	const env = await setup({ backend: ['author-gh'] });
	await onBlockAction(env.app, click('take', 'au'), env.read, env.http, env.persis, env.modify);
	assert.equal((await env.store.getPr('RocketChat/Rocket.Chat', 1))?.reviewers[0].rcUsername, 'alice');
	assert.match(env.told[0].text, /You wrote `Rocket\.Chat#1`/);
});

test('Take it matches any team of the original slot and names the person replaced', async () => {
	const env = await setup({ architecture: ['arch'], backend: ['alice'] });
	await onBlockAction(env.app, click('take', 'a1'), env.read, env.http, env.persis, env.modify);
	const reviewers = (await env.store.getPr('RocketChat/Rocket.Chat', 1))?.reviewers ?? [];
	assert.deepEqual(
		reviewers.map((r) => r.rcUsername),
		['arch'],
	);
	assert.equal(env.thread[0], '@arch took architecture/backend (from @alice)');
});

test('Reassign with no user draws again over every slot the old reviewer covered', async () => {
	const s1: Slot = { pattern: '/a/', teams: ['backend'] };
	const s2: Slot = { pattern: '/b/', teams: ['frontend'] };
	const pr = record({
		reviewers: [
			{ ghLogin: 'alice', rcUserId: 'k1', rcUsername: 'alice', teams: ['backend', 'frontend'], slots: [s1, s2], status: 'pending' },
		],
	});
	const env = await setup({ backend: ['alice', 'bob'], frontend: ['alice', 'fe'] }, pr);
	await onViewSubmit(env.app, submit('req', 'r0'), env.read, env.http, env.persis, env.modify);
	const updated = await env.store.getPr('RocketChat/Rocket.Chat', 1);
	assert.deepEqual(updated?.reviewers.map((r) => r.ghLogin).sort(), ['bob', 'fe']);
	assert.deepEqual(updated?.unfilledSlots, []);
});

const be: Slot = { pattern: '/apps/meteor/server', teams: ['backend'] };
const fe: Slot = { pattern: '/apps/meteor/client/', teams: ['frontend'] };
const reviewer = (login: string, id: string, slots: Slot[], teams: string[]) => ({
	ghLogin: login,
	rcUserId: id,
	rcUsername: login,
	teams,
	slots,
	status: 'pending' as const,
});

test('Take it covers every row whose team you are in', async () => {
	const pr = record({ reviewers: [reviewer('alice', 'k1', [be], ['backend']), reviewer('bob', 'd1', [fe], ['frontend'])] });
	const env = await setup({ backend: ['alice', 'arch'], frontend: ['bob', 'arch'] }, pr);
	await onBlockAction(env.app, click('take', 'a1'), env.read, env.http, env.persis, env.modify);
	const updated = await env.store.getPr('RocketChat/Rocket.Chat', 1);
	assert.deepEqual(
		updated?.reviewers.map((r) => [r.rcUsername, r.teams]),
		[['arch', ['backend', 'frontend']]],
	);
	assert.equal(env.thread[0], '@arch took backend, frontend (from @alice, @bob)');
});

test('Take it leaves the old reviewer the rows you cannot cover', async () => {
	const pr = record({ reviewers: [reviewer('alice', 'k1', [be, fe], ['backend', 'frontend'])] });
	const env = await setup({ backend: ['alice'], frontend: ['alice', 'arch'] }, pr);
	await onBlockAction(env.app, click('take', 'a1'), env.read, env.http, env.persis, env.modify);
	const updated = await env.store.getPr('RocketChat/Rocket.Chat', 1);
	assert.deepEqual(
		updated?.reviewers.map((r) => [r.rcUsername, r.slots?.map((x) => x.pattern), r.teams]),
		[
			['alice', ['/apps/meteor/server'], ['backend']],
			['arch', ['/apps/meteor/client/'], ['frontend']],
		],
	);
	assert.equal(env.thread[0], '@arch took frontend (from @alice)');
});

test('Take it fills a row that had no reviewer', async () => {
	const pr = record({ reviewers: [reviewer('alice', 'k1', [be], ['backend'])], unfilledSlots: [fe] });
	const env = await setup({ backend: ['alice'], frontend: ['arch'] }, pr);
	await onBlockAction(env.app, click('take', 'a1'), env.read, env.http, env.persis, env.modify);
	const updated = await env.store.getPr('RocketChat/Rocket.Chat', 1);
	assert.deepEqual(updated?.unfilledSlots, []);
	assert.deepEqual(
		updated?.reviewers.map((r) => r.rcUsername),
		['alice', 'arch'],
	);
	assert.equal(env.thread[0], '@arch took frontend');
});

test('a draw skips people whose Rocket.Chat user is deactivated', async () => {
	const s1: Slot = { pattern: '/a/', teams: ['backend'] };
	const pr = record({
		reviewers: [{ ghLogin: 'alice', rcUserId: 'k1', rcUsername: 'alice', teams: ['backend'], slots: [s1], status: 'pending' }],
	});
	const env = await setup({ backend: ['alice', 'old-gh', 'bob'] }, pr);
	await env.store.savePr(record({ number: 2, cardMessageId: 'm2', reviewers: [{ ghLogin: 'bob', status: 'pending' }] }));
	await onViewSubmit(env.app, submit('req', 'r0'), env.read, env.http, env.persis, env.modify);
	assert.deepEqual(
		(await env.store.getPr('RocketChat/Rocket.Chat', 1))?.reviewers.map((r) => r.ghLogin),
		['bob'],
	);
});

test('Reassign can remove a reviewer, which leaves their teams without one', async () => {
	const env = await setup();
	await onViewSubmit(env.app, submit('req', 'r0', undefined, 'remove'), env.read, env.http, env.persis, env.modify);
	const updated = await env.store.getPr('RocketChat/Rocket.Chat', 1);
	assert.deepEqual(updated?.reviewers, []);
	assert.deepEqual(updated?.unfilledSlots, [both]);
	assert.equal(env.thread[0], '@req removed @alice (architecture/backend)');
});

test('the Reassign modal offers replace and remove', async () => {
	const env = await setup();
	const response = (await onBlockAction(env.app, click('reassign', 'req'), env.read, env.http, env.persis, env.modify)) as unknown as {
		view: { blocks: { blockId: string; element: { options?: { value: string }[] } }[] };
	};
	const action = response.view.blocks.find((b) => b.blockId === 'action');
	assert.deepEqual(
		action?.element.options?.map((o) => o.value),
		['replace', 'remove'],
	);
});

test('a draw skips people listed as not available', async () => {
	const s1: Slot = { pattern: '/a/', teams: ['backend'] };
	const pr = record({
		reviewers: [{ ghLogin: 'alice', rcUserId: 'k1', rcUsername: 'alice', teams: ['backend'], slots: [s1], status: 'pending' }],
	});
	const env = await setup({ backend: ['alice', 'pto', 'bob'] }, pr, { not_available: 'pto until 2099-01-01' });
	await env.store.savePr(record({ number: 2, cardMessageId: 'm2', reviewers: [{ ghLogin: 'bob', status: 'pending' }] }));
	await onViewSubmit(env.app, submit('req', 'r0'), env.read, env.http, env.persis, env.modify);
	assert.deepEqual(
		(await env.store.getPr('RocketChat/Rocket.Chat', 1))?.reviewers.map((r) => r.ghLogin),
		['bob'],
	);
});
