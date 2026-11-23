import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fakeEnv } from './fakes';
import { notAvailable, settings } from './settings';

test('a login with no date is never drawn', () => {
	assert.deepEqual(notAvailable('AliceSmith', '2026-11-23'), ['alicesmith']);
});

test('a login with a date is skipped until that day, inclusive', () => {
	const text = '@carolw until 2026-11-30\nbobjones until 2026-11-23\nold until 2026-11-22';
	assert.deepEqual(notAvailable(text, '2026-11-23'), ['carolw', 'bobjones']);
});

test('blank lines, comments and malformed lines are ignored', () => {
	assert.deepEqual(notAvailable('\n# PTO\nalice until soon\na b c\n', '2026-11-23'), []);
});

test('a blank Repositories setting falls back to Rocket.Chat', async () => {
	const env = fakeEnv({ settings: { repositories: ' \n ' } });
	assert.deepEqual((await settings(env.read)).repos, ['RocketChat/Rocket.Chat']);
});
