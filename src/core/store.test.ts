import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fakeEnv } from './fakes';
import { parseUserLinks, Store } from './store';

const users = [
	{ id: 'k1', username: 'alice' },
	{ id: 'd1', username: 'bob.jones' },
];

test('parseUserLinks reads one pair per line and skips the rest', () => {
	assert.deepEqual(parseUserLinks('alice AliceSmith\n@bob.jones   bobjones\n\n# a comment\nonly-one-word\na b c\n'), [
		{ rcUsername: 'alice', ghLogin: 'AliceSmith' },
		{ rcUsername: 'bob.jones', ghLogin: 'bobjones' },
	]);
});

test('a configured line links a user both ways, ignoring GitHub case', async () => {
	const env = fakeEnv({ users, settings: { user_links: 'alice AliceSmith' } });
	const store = new Store(env.read, env.persis);
	assert.deepEqual(await store.getLinkByGh('alicesmith'), { rcUserId: 'k1', rcUsername: 'alice', ghLogin: 'AliceSmith' });
	assert.deepEqual(await store.getLinkByRc('k1'), { rcUserId: 'k1', rcUsername: 'alice', ghLogin: 'AliceSmith' });
});

test('a configured line for an unknown Rocket.Chat user is skipped', async () => {
	const env = fakeEnv({ users, settings: { user_links: 'nobody ghost' } });
	assert.equal(await new Store(env.read, env.persis).getLinkByGh('ghost'), undefined);
});

test('inactiveGhLogins lists linked people whose Rocket.Chat user is deactivated', async () => {
	const env = fakeEnv({
		users: [...users, { id: 'o1', username: 'old', isEnabled: false }],
		settings: { user_links: 'alice AliceSmith\nold OldTimer' },
	});
	assert.deepEqual(await new Store(env.read, env.persis).inactiveGhLogins(), ['OldTimer']);
});
