import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { IHttp } from '@rocket.chat/apps-engine/definition/accessors';

import { updatePr } from './update-pr';
import { fakeEnv } from '../core/fakes';
import { Store } from '../core/store';
import type { PrRecord } from '../core/types';

const open = (over: Partial<PrRecord> = {}): PrRecord => ({
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
	cardMessageId: 'm1',
	...over,
});

test('a PR whose card was deleted stops being tracked, without calling GitHub', async () => {
	const env = fakeEnv({ messages: [] });
	const store = new Store(env.read, env.persis);
	await store.savePr(open());
	const calls: string[] = [];
	const http = {
		get: async (url: string) => {
			calls.push(url);
			return { statusCode: 500 };
		},
	} as unknown as IHttp;
	await updatePr(env.app, 'RocketChat/Rocket.Chat', 1, env.read, env.modify, http, env.persis);
	assert.equal((await store.getPr('RocketChat/Rocket.Chat', 1))?.state, 'stopped');
	assert.deepEqual(await store.listOpenPrs(), []);
	assert.deepEqual(calls, []);
});

test('a stopped PR is never brought back by an update', async () => {
	const env = fakeEnv({
		pulls: {
			1: { title: 't', html_url: 'u', draft: false, additions: 1, deletions: 1, user: { login: 'a' }, state: 'open', merged: false },
		},
	});
	const store = new Store(env.read, env.persis);
	await store.savePr(open({ state: 'stopped' }));
	await updatePr(env.app, 'RocketChat/Rocket.Chat', 1, env.read, env.modify, env.http, env.persis);
	assert.equal((await store.getPr('RocketChat/Rocket.Chat', 1))?.state, 'stopped');
});
