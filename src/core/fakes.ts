import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import type { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

type Entry = { data: object; keys: string[] };
type User = { id: string; username: string; isEnabled?: boolean; roles?: string[] };

const keyOf = (record: RocketChatAssociationRecord) => `${record.getModel()}:${record.getID()}`;

export function fakeEnv(
	options: {
		users?: User[];
		settings?: Record<string, unknown>;
		teams?: Record<string, string[] | null>;
		pulls?: Record<number, object>;
		messages?: string[];
	} = {},
) {
	const entries: Entry[] = [];
	const told: { user: string; text: string }[] = [];
	const thread: string[] = [];
	const users = options.users ?? [];
	const settings = { github_token: 'tok', repositories: 'RocketChat/Rocket.Chat', target_room: [{ _id: 'r1' }], ...options.settings };
	const matching = (keys: RocketChatAssociationRecord[]) => entries.filter((e) => keys.every((k) => e.keys.includes(keyOf(k))));
	const remove = (keys: RocketChatAssociationRecord[]) => {
		for (const e of matching(keys)) {
			entries.splice(entries.indexOf(e), 1);
		}
		return [];
	};

	const persis = {
		createWithAssociations: async (data: object, keys: RocketChatAssociationRecord[]) => {
			entries.push({ data, keys: keys.map(keyOf) });
			return 'id';
		},
		removeByAssociation: async (key: RocketChatAssociationRecord) => remove([key]),
		removeByAssociations: async (keys: RocketChatAssociationRecord[]) => remove(keys),
		updateByAssociation: async (key: RocketChatAssociationRecord, data: object) => {
			remove([key]);
			entries.push({ data, keys: [keyOf(key)] });
			return 'id';
		},
	} as unknown as IPersistence;

	const read = {
		getEnvironmentReader: () => ({
			getSettings: () => ({ getValueById: async (id: string) => (settings as Record<string, unknown>)[id] }),
		}),
		getPersistenceReader: () => ({ readByAssociations: async (keys: RocketChatAssociationRecord[]) => matching(keys).map((e) => e.data) }),
		getUserReader: () => ({
			getAppUser: async () => ({ id: 'bot', username: 'review.bot' }),
			getById: async (id: string) => users.find((u) => u.id === id),
			getByUsername: async (username: string) => users.find((u) => u.username === username),
		}),
		getRoomReader: () => ({ getById: async (id: string) => ({ id }) }),
		getMessageReader: () => ({ getById: async (id: string) => (!options.messages || options.messages.includes(id) ? { id } : undefined) }),
	} as unknown as IRead;

	const builder = (onText: (text: string) => void) => {
		const b: Record<string, unknown> = {};
		for (const m of ['setRoom', 'setSender', 'setBlocks', 'setParseUrls', 'setThreadId']) {
			b[m] = () => b;
		}
		b.setText = (text: string) => {
			onText(text);
			return b;
		};
		b.getMessage = () => b;
		return b;
	};
	const notice = { text: '' };
	const modify = {
		getUpdater: () => ({
			message: async (id: string) => {
				if (options.messages && !options.messages.includes(id)) {
					throw new Error(`Message ${id} not found`);
				}
				return builder(() => undefined);
			},
			finish: async () => undefined,
		}),
		getCreator: () => ({ startMessage: () => builder((text) => thread.push(text)), finish: async () => 'm1' }),
		getNotifier: () => ({
			getMessageBuilder: () =>
				builder((text) => {
					notice.text = text;
				}),
			notifyUser: async (user: User) => told.push({ user: user.username, text: notice.text }),
		}),
	} as unknown as IModify;

	const http = {
		get: async (url: string) => {
			const login = url.match(/\/users\/([^/?]+)$/)?.[1];
			if (login) {
				return { statusCode: 200, data: { login: decodeURIComponent(login) } };
			}
			const reviews = url.match(/\/pulls\/(\d+)\/reviews/);
			if (reviews) {
				return { statusCode: 200, data: [] };
			}
			const pull = url.match(/\/pulls\/(\d+)$/)?.[1];
			if (pull) {
				return options.pulls?.[Number(pull)] ? { statusCode: 200, data: options.pulls[Number(pull)] } : { statusCode: 404 };
			}
			const team = url.match(/\/teams\/([^/]+)\/members/)?.[1];
			if (team && options.teams?.[team] === null) {
				return { statusCode: 404 };
			}
			const logins = team ? (options.teams?.[team] ?? []) : [];
			return { statusCode: 200, data: logins.map((member) => ({ login: member })) };
		},
	} as unknown as IHttp;

	const app = {
		getID: () => 'app',
		getLogger: () => ({ error: () => undefined, warn: () => undefined }),
		getAccessors: () => ({
			environmentWriter: {
				getSettings: () => ({
					updateValue: async (id: string, value: unknown) => {
						(settings as Record<string, unknown>)[id] = value;
					},
				}),
			},
		}),
	} as unknown as App;
	return { read, persis, modify, http, app, entries, told, thread, settings: settings as Record<string, unknown> };
}
