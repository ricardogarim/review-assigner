import type { IUser } from '@rocket.chat/apps-engine/definition/users';

import type { Store } from '../core/store';
import type { PrRecord } from '../core/types';
import { sameLogin } from '../core/utils';

export const REASSIGN_REFUSED = 'Only the author, the requester or a current reviewer can reassign.';

export async function isAuthor(record: PrRecord, user: IUser, store: Store): Promise<boolean> {
	return sameLogin((await store.getLinkByRc(user.id))?.ghLogin, record.authorLogin);
}

export async function canReassign(record: PrRecord, user: IUser, store: Store): Promise<boolean> {
	return record.requestedBy === user.id || record.reviewers.some((r) => r.rcUserId === user.id) || isAuthor(record, user, store);
}
