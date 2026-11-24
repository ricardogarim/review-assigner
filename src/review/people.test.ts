import assert from 'node:assert/strict';
import { test } from 'node:test';

import { removeAway, removeLink, setAway, setLink } from './people';

test('setAway replaces the line for the same login and keeps the rest', () => {
	assert.equal(setAway('# PTO\nAlice until 2026-11-01\nbob', 'alice', '2026-12-01'), '# PTO\nbob\nalice until 2026-12-01');
	assert.equal(setAway('', 'carol'), 'carol');
	assert.equal(removeAway('@alice\nbob', 'Alice'), 'bob');
});

test('setLink replaces any line with the same Rocket.Chat user or GitHub login', () => {
	const text = '# team\nalice AliceOld\nbob BobGh\ncarol carolgh';
	assert.equal(setLink(text, 'alice', 'bobgh'), '# team\ncarol carolgh\nalice bobgh');
	assert.equal(removeLink(text, '@bob'), '# team\nalice AliceOld\ncarol carolgh');
	assert.equal(removeLink(text, 'aliceold'), '# team\nbob BobGh\ncarol carolgh');
});
