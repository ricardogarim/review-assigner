import assert from 'node:assert/strict';
import { test } from 'node:test';

import { prCode, prLabel, slotLabel } from './labels';

test('slotLabel joins the teams', () => {
	assert.equal(slotLabel({ pattern: 'x', teams: ['architecture', 'backend'] }), 'architecture/backend');
});

test('prCode wraps the short PR label in backticks', () => {
	assert.equal(prLabel('RocketChat/Rocket.Chat', 1), 'Rocket.Chat#1');
	assert.equal(prCode('RocketChat/Rocket.Chat', 1), '`Rocket.Chat#1`');
});
