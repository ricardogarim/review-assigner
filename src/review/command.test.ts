import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

import { ReviewCommand } from './command';
import { fakeEnv } from '../core/fakes';
import { Store } from '../core/store';

const sender = { id: 'u1', username: 'dana' };

async function runIn(env: ReturnType<typeof fakeEnv>, args: string[], who = sender) {
	const context = { getSender: () => who, getRoom: () => ({ id: 'r1' }), getArguments: () => args } as unknown as SlashCommandContext;
	await new ReviewCommand(env.app).executor(context, env.read, env.modify, env.http, env.persis);
	return env.told.map((t) => t.text);
}

async function run(args: string[]) {
	return runIn(fakeEnv({ users: [sender] }), args);
}

test('/review without a PR answers with one usage line', async () => {
	const usage = 'Usage: `/review <pr number, repo#number or PR URL> [@user ...]` or `/review workload`';
	assert.deepEqual(await run([]), [usage]);
	assert.deepEqual(await run(['help']), [usage]);
});

test('re-requesting a PR whose card was deleted posts a new card', async () => {
	const pull = { title: 't', html_url: 'u', draft: false, additions: 1, deletions: 1, user: { login: 'a' }, state: 'open', merged: false };
	const env = fakeEnv({ users: [sender, { id: 'k1', username: 'alice' }], pulls: { 1: pull }, messages: [] });
	const store = new Store(env.read, env.persis);
	await store.savePr({
		number: 1,
		title: 't',
		url: 'u',
		repo: 'RocketChat/Rocket.Chat',
		additions: 1,
		deletions: 1,
		authorLogin: 'a',
		state: 'open',
		reviewers: [],
		unfilledSlots: [],
		requestedBy: 'u1',
		roomId: 'r1',
		cardMessageId: 'gone',
	} as never);
	const told = await runIn(env, ['1', '@alice']);
	const record = await store.getPr('RocketChat/Rocket.Chat', 1);
	assert.equal(record?.cardMessageId, 'm1');
	assert.deepEqual(
		record?.reviewers.map((r) => r.rcUsername),
		['alice'],
	);
	assert.ok(!told.some((t) => t.startsWith('Something went wrong')), told.join(' | '));
});
