import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IRead } from '@rocket.chat/apps-engine/definition/accessors';

import { parseUserLinks } from '../core/store';

export const PEOPLE_USAGE = [
	'`/review ooo` lists who is out of office.',
	'`/review ooo <github-login or @user> [until YYYY-MM-DD]` adds or changes one.',
	'`/review ooo remove <github-login or @user>` removes one.',
	'`/review link` lists the linked users.',
	'`/review link @user <github-login>` adds or changes a link.',
	'`/review link remove <@user or github-login>` removes one.',
].join('\n');

const bare = (word: string) => word.replace(/^@/, '').toLowerCase();

const lines = (text: string) => text.split('\n').filter((line) => line.trim());

function replaceLines(text: string, drop: (words: string[]) => boolean, added?: string): string {
	const kept = lines(text).filter((line) => {
		const words = line.trim().split(/\s+/);
		return words[0].startsWith('#') || !drop(words.map(bare));
	});
	return [...kept, ...(added ? [added] : [])].join('\n');
}

export const setAway = (text: string, login: string, until?: string): string =>
	replaceLines(text, ([first]) => first === bare(login), until ? `${login} until ${until}` : login);

export const removeAway = (text: string, login: string): string => replaceLines(text, ([first]) => first === bare(login));

export const setLink = (text: string, rcUsername: string, ghLogin: string): string =>
	replaceLines(text, ([rc, gh]) => rc === bare(rcUsername) || gh === bare(ghLogin), `${rcUsername} ${ghLogin}`);

export const removeLink = (text: string, who: string): string =>
	replaceLines(text, ([rc, gh]) => (who.startsWith('@') ? rc === bare(who) : gh === bare(who)));

type Edit = { setting: 'not_available' | 'user_links'; value: string; note: string };

async function edit(args: string[], read: IRead, current: (id: Edit['setting']) => Promise<string>): Promise<Edit | string> {
	const [what, ...rest] = args.map((a) => a.trim()).filter(Boolean);
	const removing = rest[0]?.toLowerCase() === 'remove';
	const [who, ...more] = removing ? rest.slice(1) : rest;

	if (what === 'ooo') {
		const text = await current('not_available');
		if (!who) {
			return lines(text).length ? `Out of office:\n${text}` : 'Nobody is out of office.';
		}
		let login = who;
		if (who.startsWith('@')) {
			const link = parseUserLinks(await current('user_links')).find((l) => bare(l.rcUsername) === bare(who));
			if (!link) {
				return `${who} has no linked GitHub login. Use their GitHub login.`;
			}
			login = link.ghLogin;
		}
		if (removing) {
			return { setting: 'not_available', value: removeAway(text, login), note: `${login} is back.` };
		}
		const until = more[0]?.toLowerCase() === 'until' ? more[1] : undefined;
		if (more.length && !until?.match(/^\d{4}-\d{2}-\d{2}$/)) {
			return 'Write the date as `until YYYY-MM-DD`.';
		}
		return {
			setting: 'not_available',
			value: setAway(text, login, until),
			note: `${login} is out of office${until ? ` until ${until}` : ''}.`,
		};
	}

	const text = await current('user_links');
	if (!who) {
		return lines(text).length ? `Linked users:\n${text}` : 'No linked users.';
	}
	if (removing) {
		return { setting: 'user_links', value: removeLink(text, who), note: `Removed the link for ${who}.` };
	}
	if (!who.startsWith('@') || more.length !== 1) {
		return 'Usage: `/review link @user <github-login>`';
	}
	if (!(await read.getUserReader().getByUsername(bare(who)))) {
		return `Unknown user ${who}.`;
	}
	return { setting: 'user_links', value: setLink(text, who.slice(1), more[0].replace(/^@/, '')), note: `Linked ${who} to ${more[0]}.` };
}

export async function peopleCommand(app: App, args: string[], read: IRead): Promise<{ text: string; changed: boolean }> {
	const reader = read.getEnvironmentReader().getSettings();
	const result = await edit(args, read, async (id) => String((await reader.getValueById(id)) ?? ''));
	if (typeof result === 'string') {
		return { text: result, changed: false };
	}
	await app.getAccessors().environmentWriter.getSettings().updateValue(result.setting, result.value);
	return { text: result.note, changed: true };
}
