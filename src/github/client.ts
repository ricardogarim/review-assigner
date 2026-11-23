import type { IHttp, IHttpResponse } from '@rocket.chat/apps-engine/definition/accessors';

import type { GhReview } from '../core/types';

const API = 'https://api.github.com';
const PAGE = 100;

export class GitHubError extends Error {
	constructor(
		public readonly status: number,
		public readonly path: string,
	) {
		super(`GitHub ${status} on ${path}`);
	}
}

export type PullInfo = {
	title: string;
	url: string;
	draft: boolean;
	additions: number;
	deletions: number;
	authorLogin: string;
	state: 'open' | 'closed';
	merged: boolean;
};

export class GitHub {
	constructor(
		private readonly http: IHttp,
		private readonly token: string,
		private readonly repo: string,
	) {}

	private async call(path: string, params?: Record<string, string>, accept = 'application/vnd.github+json'): Promise<IHttpResponse> {
		const response = await this.http.get(`${API}${path}`, {
			headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': accept, 'User-Agent': 'review-assigner' },
			...(params && { params }),
		});
		if (response.statusCode < 200 || response.statusCode >= 300) {
			throw new GitHubError(response.statusCode, path);
		}
		return response;
	}

	private async json<T>(path: string, params?: Record<string, string>): Promise<T> {
		const response = await this.call(path, params);
		return (response.data ?? JSON.parse(response.content ?? 'null')) as T;
	}

	private async paged<T>(path: string): Promise<T[]> {
		const all: T[] = [];
		for (let page = 1; ; page++) {
			const items = await this.json<T[]>(path, { per_page: String(PAGE), page: String(page) });
			all.push(...items);
			if (items.length < PAGE) {
				return all;
			}
		}
	}

	async getPull(number: number): Promise<PullInfo> {
		const pull = await this.json<{
			title: string;
			html_url: string;
			draft: boolean;
			additions: number;
			deletions: number;
			user: { login: string };
			state: 'open' | 'closed';
			merged: boolean;
		}>(`/repos/${this.repo}/pulls/${number}`);
		return {
			title: pull.title,
			url: pull.html_url,
			draft: pull.draft,
			additions: pull.additions,
			deletions: pull.deletions,
			authorLogin: pull.user.login,
			state: pull.state,
			merged: pull.merged,
		};
	}

	async listFiles(number: number): Promise<string[]> {
		const files = await this.paged<{ filename: string }>(`/repos/${this.repo}/pulls/${number}/files`);
		return files.map((file) => file.filename);
	}

	async getCodeowners(): Promise<string> {
		const response = await this.call(`/repos/${this.repo}/contents/.github/CODEOWNERS`, undefined, 'application/vnd.github.raw');
		return response.content ?? '';
	}

	async teamMembers(team: string): Promise<string[]> {
		if (team.startsWith('@')) {
			return [team.slice(1)];
		}
		const org = this.repo.split('/')[0];
		const members = await this.paged<{ login: string }>(`/orgs/${org}/teams/${team.toLowerCase()}/members`);
		return members.map((member) => member.login);
	}

	async listReviews(number: number): Promise<GhReview[]> {
		const reviews = await this.paged<{ user: { login: string } | null; state: string }>(`/repos/${this.repo}/pulls/${number}/reviews`);
		const states = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'];
		return reviews.flatMap(({ user, state }) =>
			user && states.includes(state) ? [{ login: user.login, state: state as GhReview['state'] }] : [],
		);
	}
}
