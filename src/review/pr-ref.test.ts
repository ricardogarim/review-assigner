import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePrRef } from './pr-ref';

const repos = ['RocketChat/Rocket.Chat', 'RocketChat/Rocket.Chat.Electron'];

test('a bare number points to the first watched repo', () => {
	assert.deepEqual(parsePrRef('1234', repos), { repo: 'RocketChat/Rocket.Chat', number: 1234 });
	assert.deepEqual(parsePrRef('#1234', repos), { repo: 'RocketChat/Rocket.Chat', number: 1234 });
});

test('name#n and owner/name#n pick a watched repo, ignoring case', () => {
	assert.deepEqual(parsePrRef('rocket.chat.electron#3604', repos), { repo: 'RocketChat/Rocket.Chat.Electron', number: 3604 });
	assert.deepEqual(parsePrRef('RocketChat/Rocket.Chat.Electron#3604', repos), { repo: 'RocketChat/Rocket.Chat.Electron', number: 3604 });
});

test('a PR URL picks its repo', () => {
	assert.deepEqual(parsePrRef('https://github.com/RocketChat/Rocket.Chat.Electron/pull/3604', repos), {
		repo: 'RocketChat/Rocket.Chat.Electron',
		number: 3604,
	});
});

test('a repo that is not watched is reported, not guessed', () => {
	assert.deepEqual(parsePrRef('https://github.com/someone/else/pull/1', repos), { unwatched: 'someone/else' });
	assert.deepEqual(parsePrRef('else#1', repos), { unwatched: 'else' });
});

test('anything else is not a PR reference', () => {
	assert.equal(parsePrRef('help', repos), undefined);
	assert.equal(parsePrRef(undefined, repos), undefined);
});
