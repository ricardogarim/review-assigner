import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import type { IApiEndpointInfo, IApiRequest } from '@rocket.chat/apps-engine/definition/api';

import { GitHubWebhook } from './webhook';

function fakeRead(stored: object[]) {
	const values: Record<string, unknown> = { webhook_token: 'secret', github_token: 'tok', repositories: 'RocketChat/Rocket.Chat' };
	return {
		getEnvironmentReader: () => ({ getSettings: () => ({ getValueById: async (id: string) => values[id] }) }),
		getPersistenceReader: () => ({ readByAssociations: async () => stored }),
	} as unknown as IRead;
}

function fakeHttp() {
	const calls: string[] = [];
	return {
		http: {
			get: async (url: string) => {
				calls.push(url);
				return { statusCode: 500 };
			},
		} as unknown as IHttp,
		calls,
	};
}

const request = (token: string | undefined, number: number, repo = 'RocketChat/Rocket.Chat'): IApiRequest =>
	({
		method: 'post',
		headers: { 'x-github-event': 'pull_request_review' },
		query: token ? { token } : {},
		params: {},
		content: { action: 'submitted', repository: { full_name: repo }, pull_request: { number } },
	}) as unknown as IApiRequest;

const webhook = () =>
	new GitHubWebhook({ getID: () => 'app', getLogger: () => ({ error: () => undefined, warn: () => undefined }) } as unknown as App);
const post = (req: IApiRequest, read: IRead, http: IHttp) =>
	webhook().post(req, {} as IApiEndpointInfo, read, {} as IModify, http, {} as IPersistence);

test('a wrong or missing token gets 401 and calls nothing', async () => {
	for (const token of ['bad', undefined]) {
		const { http, calls } = fakeHttp();
		const response = await post(request(token, 1234), fakeRead([]), http);
		assert.equal(response.status, 401);
		assert.deepEqual(calls, []);
	}
});

test('an untracked PR gets 200 and calls nothing', async () => {
	const { http, calls } = fakeHttp();
	const response = await post(request('secret', 1234), fakeRead([]), http);
	assert.equal(response.status, 200);
	assert.deepEqual(calls, []);
});

test('an event for a tracked number in another repo changes nothing', async () => {
	const { http, calls } = fakeHttp();
	const tracked = { number: 1234, repo: 'RocketChat/Rocket.Chat', state: 'open', reviewers: [] };
	const read = {
		...fakeRead([]),
		getPersistenceReader: () => ({
			readByAssociations: async (keys: { getID(): string }[]) =>
				keys.some((k) => k.getID() === 'pr:RocketChat/Rocket.Chat#1234') ? [tracked] : [],
		}),
	} as unknown as IRead;
	const response = await post(request('secret', 1234, 'someone/else'), read, http);
	assert.equal(response.status, 200);
	assert.deepEqual(calls, []);
});
