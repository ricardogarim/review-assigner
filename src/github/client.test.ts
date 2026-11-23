import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { IHttp, IHttpRequest, IHttpResponse } from '@rocket.chat/apps-engine/definition/accessors';

import { GitHub, GitHubError } from './client';

type Call = { url: string; options?: IHttpRequest };

function fakeHttp(respond: (call: Call) => Partial<IHttpResponse>) {
	const calls: Call[] = [];
	const get = async (url: string, options?: IHttpRequest) => {
		calls.push({ url, options });
		return { statusCode: 200, ...respond({ url, options }) } as IHttpResponse;
	};
	return { http: { get } as unknown as IHttp, calls };
}

test('sends auth, accept and user-agent headers', async () => {
	const { http, calls } = fakeHttp(() => ({ data: [] }));
	await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').teamMembers('backend');
	assert.equal(calls[0].url, 'https://api.github.com/orgs/RocketChat/teams/backend/members');
	assert.deepEqual(calls[0].options?.headers, {
		'Authorization': 'Bearer tok',
		'Accept': 'application/vnd.github+json',
		'User-Agent': 'review-assigner',
	});
});

test('getPull maps the fields the card needs', async () => {
	const { http, calls } = fakeHttp(() => ({
		data: {
			title: 't',
			html_url: 'u',
			draft: false,
			additions: 42,
			deletions: 8,
			user: { login: 'dana-gh' },
			state: 'closed',
			merged: true,
		},
	}));
	const pull = await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').getPull(1234);
	assert.equal(calls[0].url, 'https://api.github.com/repos/RocketChat/Rocket.Chat/pulls/1234');
	assert.deepEqual(pull, {
		title: 't',
		url: 'u',
		draft: false,
		additions: 42,
		deletions: 8,
		authorLogin: 'dana-gh',
		state: 'closed',
		merged: true,
	});
});

test('listFiles pages until a page has fewer than 100', async () => {
	const { http, calls } = fakeHttp(({ options }) => {
		const count = options?.params?.page === '1' ? 100 : 3;
		return { data: Array.from({ length: count }, (_, i) => ({ filename: `f${options?.params?.page}-${i}` })) };
	});
	const files = await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').listFiles(1);
	assert.equal(files.length, 103);
	assert.deepEqual(
		calls.map((c) => c.options?.params),
		[
			{ per_page: '100', page: '1' },
			{ per_page: '100', page: '2' },
		],
	);
});

test('getCodeowners reads .github/CODEOWNERS raw', async () => {
	const { http, calls } = fakeHttp(() => ({ content: '/a @RocketChat/b\n' }));
	assert.equal(await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').getCodeowners(), '/a @RocketChat/b\n');
	assert.equal(calls[0].url, 'https://api.github.com/repos/RocketChat/Rocket.Chat/contents/.github/CODEOWNERS');
	assert.equal(calls[0].options?.headers?.Accept, 'application/vnd.github.raw');
});

test('teamMembers uses the org from the repo and the lowercase slug', async () => {
	const { http, calls } = fakeHttp(() => ({ data: [{ login: 'alice' }, { login: 'carol' }] }));
	assert.deepEqual(await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').teamMembers('Backend'), ['alice', 'carol']);
	assert.equal(calls[0].url, 'https://api.github.com/orgs/RocketChat/teams/backend/members');
});

test('teamMembers of a user owner needs no call', async () => {
	const { http, calls } = fakeHttp(() => ({}));
	assert.deepEqual(await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').teamMembers('@someone'), ['someone']);
	assert.equal(calls.length, 0);
});

test('listReviews keeps login and state in order', async () => {
	const { http } = fakeHttp(() => ({
		data: [
			{ user: { login: 'alice' }, state: 'APPROVED' },
			{ user: { login: 'carol' }, state: 'COMMENTED' },
		],
	}));
	assert.deepEqual(await new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').listReviews(1), [
		{ login: 'alice', state: 'APPROVED' },
		{ login: 'carol', state: 'COMMENTED' },
	]);
});

test('other non-2xx answers throw GitHubError', async () => {
	const { http } = fakeHttp(() => ({ statusCode: 404 }));
	await assert.rejects(new GitHub(http, 'tok', 'RocketChat/Rocket.Chat').getPull(1), (error: unknown) => {
		assert.ok(error instanceof GitHubError);
		assert.equal(error.status, 404);
		assert.equal(error.path, '/repos/RocketChat/Rocket.Chat/pulls/1');
		return true;
	});
});
