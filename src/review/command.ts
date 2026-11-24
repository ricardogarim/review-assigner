import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import type { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import type { IUser } from '@rocket.chat/apps-engine/definition/users';

import { drawFor } from './assign';
import type { Drawn } from './assign';
import { parseCodeowners, slotsFor } from './codeowners';
import { PEOPLE_USAGE, peopleCommand } from './people';
import { parsePrRef } from './pr-ref';
import { workloadText } from './workload';
import { nameOf, prCode, prLabel, slotLabel, teamsLabel } from '../card/labels';
import { postInRoom, postOrUpdateCard, replyInThread, tellUser } from '../core/chat';
import { settings } from '../core/settings';
import { Store } from '../core/store';
import type { PrRecord, Reviewer } from '../core/types';
import { GitHub } from '../github/client';

const USAGE =
	'Usage: `/review <pr number, repo#number or PR URL> [@user ...]` or `/review workload`. In the settings room: `/review ooo` and `/review link`.';

const withTeams = (reviewer: Reviewer): string => `${nameOf(reviewer)}${reviewer.teams?.length ? ` (${teamsLabel(reviewer.teams)})` : ''}`;

function confirmation({ reviewers, unfilled, unreadable = [] }: Drawn): string {
	const unlinked = reviewers.filter((r) => !r.rcUsername);
	return [
		`Requested: ${reviewers.map(withTeams).join(', ')}`,
		unlinked.length ? `Not linked: ${unlinked.map(nameOf).join(', ')}` : '',
		unfilled.length ? `No reviewer for: ${unfilled.map(slotLabel).join(', ')}` : '',
		unreadable.length ? `Cannot read the members of ${unreadable.join(', ')}. Check that the GitHub token can see these teams.` : '',
	]
		.filter(Boolean)
		.join('\n');
}

export class ReviewCommand implements ISlashCommand {
	public command = 'review';

	public i18nParamsExample = 'review_params';

	public i18nDescription = 'review_description';

	public providesPreview = false;

	public constructor(private readonly app: App) {}

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
		const sender = context.getSender();
		const say = (text: string) => tellUser(sender, context.getRoom(), text, modify, read);
		const [first, ...rest] = context.getArguments();
		const sub = first?.toLowerCase() ?? '';
		const store = new Store(read, persis);

		try {
			const s = await settings(read);
			if (sub === 'workload') {
				return await say(workloadText(await store.listOpenPrs(), s.notAvailable, Date.now()));
			}
			if (sub === 'ooo' || sub === 'link') {
				if (!s.settingsRoomId || context.getRoom().id !== s.settingsRoomId) {
					return await say('Use this command in the settings room. An admin picks it in the app settings.');
				}
				const { text, changed } = await peopleCommand(this.app, [sub, ...rest], read);
				return changed ? await postInRoom(context.getRoom(), `@${sender.username}: ${text}`, modify, read) : await say(text);
			}
			if (sub === 'help') {
				return await say(`${USAGE}\n${PEOPLE_USAGE}`);
			}
			const ref = parsePrRef(first, s.repos);
			if (!ref) {
				return await say(USAGE);
			}
			if ('unwatched' in ref) {
				return await say(`${ref.unwatched} is not a watched repository.`);
			}
			if (!s.token || !s.roomId) {
				return await say('Set the GitHub token and the room in the app settings first.');
			}
			const { repo, number: n } = ref;
			const refText = prCode(repo, n);
			const gh = new GitHub(http, s.token, repo);

			const named: IUser[] = [];
			for (const arg of rest.filter((a) => a.startsWith('@'))) {
				const user = await read.getUserReader().getByUsername(arg.slice(1));
				if (!user) {
					return await say(`Unknown user ${arg}.`);
				}
				named.push(user);
			}

			const pull = await gh.getPull(n);
			if (pull.draft) {
				return await say(`${refText} is a draft. Mark it ready for review first.`);
			}
			if (pull.state !== 'open') {
				return await say(`${refText} is ${pull.merged ? 'merged' : 'closed'}.`);
			}

			const namedReviewers = await Promise.all(
				named.map(async (user): Promise<Reviewer> => {
					const link = await store.getLinkByRc(user.id);
					return { ghLogin: link?.ghLogin, rcUserId: user.id, rcUsername: user.username, status: 'pending' };
				}),
			);

			const existing = await store.getPr(repo, n);
			if (existing?.state === 'open' && (await read.getMessageReader().getById(existing.cardMessageId))) {
				const added = namedReviewers.filter((r) => !existing.reviewers.some((x) => x.rcUserId === r.rcUserId));
				const record = { ...existing, title: pull.title, reviewers: [...existing.reviewers, ...added] };
				await postOrUpdateCard(record, this.app.getID(), modify, read);
				await store.savePr(record);
				if (!added.length) {
					return await say(`${refText} already has a card.`);
				}
				await replyInThread(record, `@${sender.username} added ${added.map(nameOf).join(', ')}`, modify, read);
				return await say(`Added ${added.map(nameOf).join(', ')} to ${refText}.`);
			}

			const slots = namedReviewers.length ? [] : slotsFor(parseCodeowners(await gh.getCodeowners()), await gh.listFiles(n));
			if (!namedReviewers.length && !slots.length) {
				return await say(`No CODEOWNERS team owns these files. Name a reviewer: \`/review ${prLabel(repo, n)} @user\``);
			}
			const drawn = namedReviewers.length
				? { reviewers: namedReviewers, unfilled: [] }
				: await drawFor(store, gh, s, slots, [pull.authorLogin], this.app.getLogger());

			const record: PrRecord = {
				number: n,
				title: pull.title,
				url: pull.url,
				repo,
				additions: pull.additions,
				deletions: pull.deletions,
				authorLogin: pull.authorLogin,
				authorRcUsername: (await store.getLinkByGh(pull.authorLogin))?.rcUsername,
				state: 'open',
				reviewers: drawn.reviewers,
				unfilledSlots: drawn.unfilled,
				requestedBy: sender.id,
				requestedAt: Date.now(),
				roomId: s.roomId,
				cardMessageId: '',
			};
			record.cardMessageId = await postOrUpdateCard(record, this.app.getID(), modify, read);
			await store.savePr(record);
			return await say(confirmation(drawn));
		} catch (error) {
			this.app.getLogger().error(error);
			return say(`Something went wrong: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
