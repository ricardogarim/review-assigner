import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { HttpStatusCode } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint } from '@rocket.chat/apps-engine/definition/api';
import type { IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';

import { updatePr } from './update-pr';
import { settings } from '../core/settings';
import { Store } from '../core/store';

const EVENTS = ['pull_request_review', 'pull_request'];

export class GitHubWebhook extends ApiEndpoint {
	public path = 'github';

	constructor(private readonly owner: App) {
		super(owner);
	}

	public async post(
		request: IApiRequest,
		_endpoint: IApiEndpointInfo,
		read: IRead,
		modify: IModify,
		http: IHttp,
		persis: IPersistence,
	): Promise<IApiResponse> {
		const s = await settings(read);
		if (!s.webhookToken || request.query.token !== s.webhookToken) {
			return { status: HttpStatusCode.UNAUTHORIZED };
		}
		const repo = String(request.content?.repository?.full_name ?? '');
		const n = Number(request.content?.pull_request?.number);
		if (EVENTS.includes(request.headers['x-github-event']) && repo && n && (await new Store(read).getPr(repo, n))) {
			await updatePr(this.owner, repo, n, read, modify, http, persis);
		}
		return this.success();
	}
}
