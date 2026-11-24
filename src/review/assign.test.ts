import assert from 'node:assert/strict';
import { test } from 'node:test';

import { drawFor } from './assign';
import { fakeEnv } from '../core/fakes';
import { settings } from '../core/settings';
import { Store } from '../core/store';
import { GitHub } from '../github/client';

test('a team whose members cannot be read is reported and left unfilled', async () => {
	const env = fakeEnv({ teams: { backend: null, frontend: ['fe'] } });
	const slots = [
		{ pattern: '/apps/meteor/server', teams: ['backend'] },
		{ pattern: '/apps/meteor/client/', teams: ['frontend'] },
	];
	const drawn = await drawFor(
		new Store(env.read, env.persis),
		new GitHub(env.http, 'tok', 'RocketChat/Rocket.Chat'),
		await settings(env.read),
		slots,
		[],
		env.app.getLogger(),
	);
	assert.deepEqual(
		drawn.reviewers.map((r) => r.ghLogin),
		['fe'],
	);
	assert.deepEqual(drawn.unfilled, [slots[0]]);
	assert.deepEqual(drawn.unreadable, ['backend']);
});
