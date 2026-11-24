import assert from 'node:assert/strict';
import { test } from 'node:test';

import { workloadText } from './workload';
import type { PrRecord, Reviewer } from '../core/types';

const DAY = 24 * 60 * 60 * 1000;
const now = 10 * DAY;

const record = (number: number, reviewers: Reviewer[], over: Partial<PrRecord> = {}): PrRecord => ({
	number,
	title: 't',
	url: `https://github.com/RocketChat/Rocket.Chat/pull/${number}`,
	repo: 'RocketChat/Rocket.Chat',
	additions: 1,
	deletions: 1,
	authorLogin: 'dana-gh',
	state: 'open',
	reviewers,
	unfilledSlots: [],
	requestedBy: 'u1',
	roomId: 'r1',
	cardMessageId: `m${number}`,
	...over,
});

test('lists each reviewer with their open PRs, busiest first', () => {
	const text = workloadText(
		[
			record(1, [{ ghLogin: 'Bob-gh', status: 'pending' }], { requestedAt: now - 3 * DAY }),
			record(2, [
				{ ghLogin: 'alice-gh', rcUsername: 'alice', status: 'changes_requested' },
				{ ghLogin: 'bob-gh', status: 'approved' },
			]),
			record(3, [{ ghLogin: 'alice-gh', rcUsername: 'alice', status: 'pending' }]),
			record(4, [{ ghLogin: 'carol-gh', status: 'pending' }], { state: 'merged' }),
		],
		['bob-gh'],
		now,
	);
	assert.deepEqual(text.split('\n'), [
		'Open reviews, counting only PRs sent with `/review`:',
		'*alice*: 2 · [Rocket.Chat#2](https://github.com/RocketChat/Rocket.Chat/pull/2) (changes requested), [Rocket.Chat#3](https://github.com/RocketChat/Rocket.Chat/pull/3)',
		'*Bob-gh* (out of office): 1 · [Rocket.Chat#1](https://github.com/RocketChat/Rocket.Chat/pull/1) (3d)',
	]);
});

test('says so when nobody has an open review', () => {
	assert.equal(workloadText([record(1, [{ ghLogin: 'bob-gh', status: 'approved' }])], [], now), 'No open reviews.');
});
