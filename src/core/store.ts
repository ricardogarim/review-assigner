import type { IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

import type { PrRecord } from './types';

export type Link = {
	rcUserId: string;
	rcUsername: string;
	ghLogin: string;
};

const LAST_PICKED = 5;

export function parseUserLinks(text: string): { rcUsername: string; ghLogin: string }[] {
	return text
		.split('\n')
		.map((line) => line.trim().split(/\s+/))
		.filter((parts) => parts.length === 2 && !parts[0].startsWith('#'))
		.map(([rcUsername, ghLogin]) => ({ rcUsername: rcUsername.replace(/^@/, ''), ghLogin: ghLogin.replace(/^@/, '') }));
}

const misc = (id: string) => new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, id);
const message = (id: string) => new RocketChatAssociationRecord(RocketChatAssociationModel.MESSAGE, id);
const prKey = (repo: string, n: number) => misc(`pr:${repo}#${n}`);

export class Store {
	private configured?: Promise<(Link & { active: boolean })[]>;

	constructor(
		private readonly read: IRead,
		private readonly persis?: IPersistence,
	) {}

	private get writer(): IPersistence {
		if (!this.persis) {
			throw new Error('Store opened read-only');
		}
		return this.persis;
	}

	private async find<T>(...keys: RocketChatAssociationRecord[]): Promise<T[]> {
		return (await this.read.getPersistenceReader().readByAssociations(keys)) as T[];
	}

	async getPr(repo: string, n: number): Promise<PrRecord | undefined> {
		return (await this.find<PrRecord>(prKey(repo, n)))[0];
	}

	async getPrByMessage(messageId: string): Promise<PrRecord | undefined> {
		return (await this.find<PrRecord>(message(messageId)))[0];
	}

	async listOpenPrs(): Promise<PrRecord[]> {
		return this.find<PrRecord>(misc('pr-open'));
	}

	async savePr(record: PrRecord): Promise<void> {
		const keys = [prKey(record.repo, record.number), message(record.cardMessageId), ...(record.state === 'open' ? [misc('pr-open')] : [])];
		await this.writer.removeByAssociation(prKey(record.repo, record.number));
		await this.writer.createWithAssociations(record, keys);
	}

	private configuredLinks(): Promise<(Link & { active: boolean })[]> {
		this.configured ??= (async () => {
			const text = String((await this.read.getEnvironmentReader().getSettings().getValueById('user_links')) ?? '');
			const links: (Link & { active: boolean })[] = [];
			for (const line of parseUserLinks(text)) {
				const found = await this.read.getUserReader().getByUsername(line.rcUsername);
				if (found) {
					links.push({ rcUserId: found.id, rcUsername: found.username, ghLogin: line.ghLogin, active: found.isEnabled !== false });
				}
			}
			return links;
		})();
		return this.configured;
	}

	private async link(match: (link: Link) => boolean): Promise<Link | undefined> {
		const found = (await this.configuredLinks()).find(match);
		return found && { rcUserId: found.rcUserId, rcUsername: found.rcUsername, ghLogin: found.ghLogin };
	}

	async getLinkByRc(rcUserId: string): Promise<Link | undefined> {
		return this.link((link) => link.rcUserId === rcUserId);
	}

	async getLinkByGh(login: string): Promise<Link | undefined> {
		return this.link((link) => link.ghLogin.toLowerCase() === login.toLowerCase());
	}

	async inactiveGhLogins(): Promise<string[]> {
		return (await this.configuredLinks()).filter((link) => !link.active).map((link) => link.ghLogin);
	}

	async lastPicked(team: string): Promise<string[]> {
		return (await this.find<{ logins: string[] }>(misc(`team:${team}`)))[0]?.logins ?? [];
	}

	async pushLastPicked(team: string, login: string): Promise<void> {
		const logins = [login, ...(await this.lastPicked(team)).filter((l) => l !== login)].slice(0, LAST_PICKED);
		await this.writer.updateByAssociation(misc(`team:${team}`), { team, logins }, true);
	}
}
