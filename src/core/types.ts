export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'commented';
export type PrState = 'open' | 'merged' | 'closed' | 'stopped';

export type Slot = {
	pattern: string;
	teams: string[];
};

export type Reviewer = {
	ghLogin?: string;
	rcUserId?: string;
	rcUsername?: string;
	slots?: Slot[];
	teams?: string[];
	status: ReviewStatus;
};

export type PrRecord = {
	number: number;
	title: string;
	url: string;
	repo: string;
	additions: number;
	deletions: number;
	authorLogin: string;
	authorRcUsername?: string;
	state: PrState;
	reviewers: Reviewer[];
	unfilledSlots: Slot[];
	requestedBy: string;
	roomId: string;
	cardMessageId: string;
};

export type GhReview = {
	login: string;
	state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
};

export type Card = {
	text: string;
	blocks: unknown[];
};
