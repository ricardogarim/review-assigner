import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';

import { GitHub } from './client';
import { applyPrState, applyReviews } from './status';
import { postOrUpdateCard } from '../core/chat';
import { settings } from '../core/settings';
import { Store } from '../core/store';

export async function updatePr(
	app: App,
	repo: string,
	n: number,
	read: IRead,
	modify: IModify,
	http: IHttp,
	persis: IPersistence,
): Promise<void> {
	const store = new Store(read, persis);
	const record = await store.getPr(repo, n);
	if (!record || record.state === 'stopped') {
		return;
	}
	if (!(await read.getMessageReader().getById(record.cardMessageId))) {
		await store.savePr({ ...record, state: 'stopped' });
		return;
	}
	const s = await settings(read);
	const gh = new GitHub(http, s.token, repo);
	const pending = { ...record, reviewers: record.reviewers.map((reviewer) => ({ ...reviewer, status: 'pending' as const })) };
	const next = applyReviews(applyPrState(pending, await gh.getPull(n)), await gh.listReviews(n));
	if (JSON.stringify(next) === JSON.stringify(record)) {
		return;
	}
	await postOrUpdateCard(next, app.getID(), modify, read);
	await store.savePr(next);
}
