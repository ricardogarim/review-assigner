import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyPrState, applyReviews, openLoad } from './status';
import type { PrRecord, Reviewer } from '../core/types';

const reviewer = (ghLogin: string, status: Reviewer['status'] = 'pending'): Reviewer => ({ ghLogin, status });
const record = (over: Partial<PrRecord> = {}): PrRecord => ({
	number: 1234,
	title: 'fix: keep the unread badge in threads',
	url: 'https://github.com/RocketChat/Rocket.Chat/pull/1234',
	repo: 'RocketChat/Rocket.Chat',
	additions: 42,
	deletions: 8,
	authorLogin: 'dana-gh',
	state: 'open',
	reviewers: [reviewer('alice'), reviewer('carol')],
	unfilledSlots: [],
	requestedBy: 'u1',
	roomId: 'r1',
	cardMessageId: 'm1',
	...over,
});
const statuses = (r: PrRecord) => r.reviewers.map((x) => x.status);

test('APPROVED and CHANGES_REQUESTED set the status', () => {
	const result = applyReviews(record(), [
		{ login: 'alice', state: 'APPROVED' },
		{ login: 'carol', state: 'CHANGES_REQUESTED' },
	]);
	assert.deepEqual(statuses(result), ['approved', 'changes_requested']);
});

test('COMMENTED moves only pending to commented', () => {
	const result = applyReviews(record(), [
		{ login: 'alice', state: 'APPROVED' },
		{ login: 'alice', state: 'COMMENTED' },
		{ login: 'carol', state: 'COMMENTED' },
	]);
	assert.deepEqual(statuses(result), ['approved', 'commented']);
});

test('DISMISSED goes back to pending', () => {
	const result = applyReviews(record(), [
		{ login: 'alice', state: 'APPROVED' },
		{ login: 'alice', state: 'DISMISSED' },
	]);
	assert.deepEqual(statuses(result), ['pending', 'pending']);
});

test('reviews from people who are not reviewers are ignored', () => {
	const input = record();
	const result = applyReviews(input, [{ login: 'stranger', state: 'APPROVED' }]);
	assert.deepEqual(result, input);
});

test('input record is not mutated', () => {
	const input = record();
	applyReviews(input, [{ login: 'alice', state: 'APPROVED' }]);
	assert.equal(input.reviewers[0].status, 'pending');
});

test('closed and merged → merged, closed → closed, title follows GitHub', () => {
	assert.equal(applyPrState(record(), { state: 'closed', merged: true, title: 't' }).state, 'merged');
	assert.equal(applyPrState(record(), { state: 'closed', merged: false, title: 't' }).state, 'closed');
	const reopened = applyPrState(record({ state: 'closed' }), { state: 'open', merged: false, title: 'new title' });
	assert.equal(reopened.state, 'open');
	assert.equal(reopened.title, 'new title');
});

test('openLoad keys are lowercase logins', () => {
	assert.deepEqual(openLoad([record({ reviewers: [reviewer('Alice')] })]), { alice: 1 });
});

test('openLoad counts open records where the reviewer has not approved', () => {
	const load = openLoad([
		record({ number: 1 }),
		record({ number: 2, reviewers: [reviewer('alice', 'changes_requested'), reviewer('carol', 'approved')] }),
		record({ number: 3, state: 'merged' }),
	]);
	assert.deepEqual(load, { alice: 2, carol: 1 });
});
