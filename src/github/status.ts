import type { GhReview, PrRecord, ReviewStatus } from '../core/types';
import { sameLogin } from '../core/utils';

function next(current: ReviewStatus, state: GhReview['state']): ReviewStatus {
	switch (state) {
		case 'APPROVED':
			return 'approved';
		case 'CHANGES_REQUESTED':
			return 'changes_requested';
		case 'DISMISSED':
			return 'pending';
		case 'COMMENTED':
			return current === 'pending' ? 'commented' : current;
	}
}

export function applyReviews(record: PrRecord, reviews: GhReview[]): PrRecord {
	const reviewers = record.reviewers.map((reviewer) => ({
		...reviewer,
		status: reviews
			.filter((review) => sameLogin(reviewer.ghLogin, review.login))
			.reduce((status, review) => next(status, review.state), reviewer.status),
	}));
	return { ...record, reviewers };
}

export function applyPrState(record: PrRecord, pr: { state: 'open' | 'closed'; merged: boolean; title: string }): PrRecord {
	if (pr.state === 'open') {
		return { ...record, state: 'open', title: pr.title };
	}
	return { ...record, state: pr.merged ? 'merged' : 'closed', title: pr.title };
}

export function openLoad(records: PrRecord[]): Record<string, number> {
	const load: Record<string, number> = {};
	for (const record of records) {
		if (record.state !== 'open') {
			continue;
		}
		for (const reviewer of record.reviewers) {
			if (reviewer.ghLogin && reviewer.status !== 'approved') {
				const login = reviewer.ghLogin.toLowerCase();
				load[login] = (load[login] ?? 0) + 1;
			}
		}
	}
	return load;
}
