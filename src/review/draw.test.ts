import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DrawInput } from './draw';
import { drawReviewers } from './draw';

const backend = { pattern: '/apps/meteor/server', teams: ['backend'] };
const architecture = { pattern: '/packages/models', teams: ['architecture'] };

const input = (over: Partial<DrawInput>): DrawInput => ({
	slots: [backend],
	members: { backend: ['a', 'b', 'c'] },
	exclude: [],
	load: {},
	lastPicked: {},
	random: () => 0,
	...over,
});
const logins = (result: ReturnType<typeof drawReviewers>) => result.picks.map((p) => p.login);

test('picks the lowest load', () => {
	assert.deepEqual(logins(drawReviewers(input({ load: { a: 2, b: 0, c: 1 } }))), ['b']);
});

test('excludes the author', () => {
	assert.deepEqual(logins(drawReviewers(input({ load: { a: 2, b: 0, c: 1 }, exclude: ['b'] }))), ['c']);
});

test('one person covers every slot they belong to', () => {
	const result = drawReviewers(
		input({ slots: [backend, architecture], members: { backend: ['x', 'y'], architecture: ['x', 'z'] }, load: { y: 0, z: 0, x: 0 } }),
	);
	assert.equal(result.picks.length, 1);
	assert.equal(result.picks[0].login, 'x');
	assert.equal(result.picks[0].slots.length, 2);
	assert.deepEqual(result.unfilled, []);
});

test('tie prefers covering more remaining slots', () => {
	const result = drawReviewers(input({ slots: [backend, architecture], members: { backend: ['y', 'x'], architecture: ['x', 'z'] } }));
	assert.deepEqual(logins(result), ['x']);
});

test('tie then prefers someone not picked last', () => {
	assert.deepEqual(logins(drawReviewers(input({ members: { backend: ['a', 'b'] }, lastPicked: { backend: ['a'] } }))), ['b']);
});

test('tie then falls back to random', () => {
	assert.deepEqual(logins(drawReviewers(input({ members: { backend: ['a', 'b'] }, random: () => 0.9 }))), ['b']);
	assert.deepEqual(logins(drawReviewers(input({ members: { backend: ['a', 'b'] }, random: () => 0.1 }))), ['a']);
});

test('slot with no candidate is unfilled', () => {
	const result = drawReviewers(input({ exclude: ['a', 'b', 'c'] }));
	assert.deepEqual(result.picks, []);
	assert.deepEqual(result.unfilled, [backend]);
});

test('logins compare without case', () => {
	assert.deepEqual(logins(drawReviewers(input({ members: { backend: ['alice', 'b'] }, exclude: ['Alice'], load: { b: 5 } }))), ['b']);
	assert.deepEqual(logins(drawReviewers(input({ members: { backend: ['alice', 'b'] }, load: { Alice: 5 } }))), ['b']);
});

test('user-owner slot', () => {
	const slot = { pattern: '/docs/x.md', teams: ['@someone'] };
	assert.deepEqual(logins(drawReviewers(input({ slots: [slot], members: { '@someone': ['someone'] } }))), ['someone']);
});

test('without grouping, each team gets its own person when it can', () => {
	const result = drawReviewers(
		input({ slots: [backend, architecture], members: { backend: ['x', 'y'], architecture: ['x', 'z'] }, groupTeams: false }),
	);
	assert.equal(result.picks.length, 2);
	assert.deepEqual(result.unfilled, []);
});

test('without grouping, one person still covers a team nobody else can', () => {
	const result = drawReviewers(
		input({ slots: [backend, architecture], members: { backend: ['x'], architecture: ['x'] }, groupTeams: false }),
	);
	assert.deepEqual(logins(result), ['x']);
	assert.equal(result.picks[0].slots.length, 2);
});

test('without grouping, one person still covers every line of their own team', () => {
	const omni = (pattern: string) => ({ pattern, teams: ['omnichannel'] });
	const result = drawReviewers(
		input({
			slots: [omni('/a'), omni('/b'), omni('/c'), backend],
			members: { omnichannel: ['o1', 'o2', 'o3'], backend: ['b1', 'b2'] },
			groupTeams: false,
		}),
	);
	assert.equal(result.picks.length, 2);
	assert.deepEqual(result.picks.map((p) => p.slots.length).sort(), [1, 3]);
});

test('without grouping, a line owned by two teams goes to someone already drawn for one of them', () => {
	const shared = { pattern: '/packages/rest-typings/', teams: ['architecture', 'backend'] };
	const result = drawReviewers(
		input({ slots: [backend, architecture, shared], members: { backend: ['b1', 'b2'], architecture: ['a1', 'a2'] }, groupTeams: false }),
	);
	assert.equal(result.picks.length, 2);
});

test('the random strategy ignores load and recency', () => {
	const result = drawReviewers(
		input({ members: { backend: ['a', 'b'] }, load: { a: 9 }, lastPicked: { backend: ['a'] }, strategy: 'random', random: () => 0 }),
	);
	assert.deepEqual(logins(result), ['a']);
});
