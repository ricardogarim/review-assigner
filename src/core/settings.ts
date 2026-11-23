import type { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import type { ISetting } from '@rocket.chat/apps-engine/definition/settings';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings';

export const SETTINGS: ISetting[] = [
	{
		id: 'github_token',
		type: SettingType.PASSWORD,
		packageValue: '',
		required: true,
		public: false,
		i18nLabel: 'setting_github_token',
		i18nDescription: 'setting_github_token_description',
	},
	{
		id: 'repositories',
		type: SettingType.STRING,
		multiline: true,
		packageValue: 'RocketChat/Rocket.Chat',
		required: true,
		public: false,
		i18nLabel: 'setting_repositories',
		i18nDescription: 'setting_repositories_description',
	},
	{
		id: 'target_room',
		type: SettingType.ROOM_PICK,
		packageValue: '',
		required: true,
		public: false,
		i18nLabel: 'setting_target_room',
		i18nDescription: 'setting_target_room_description',
	},
	{
		id: 'webhook_token',
		type: SettingType.PASSWORD,
		packageValue: '',
		required: false,
		public: false,
		i18nLabel: 'setting_webhook_token',
		i18nDescription: 'setting_webhook_token_description',
	},
	{
		id: 'webhook_active',
		type: SettingType.BOOLEAN,
		packageValue: false,
		required: false,
		public: false,
		i18nLabel: 'setting_webhook_active',
		i18nDescription: 'setting_webhook_active_description',
	},
	{
		id: 'not_available',
		type: SettingType.STRING,
		multiline: true,
		packageValue: '',
		required: false,
		public: false,
		i18nLabel: 'setting_not_available',
		i18nDescription: 'setting_not_available_description',
	},
	{
		id: 'draw_strategy',
		type: SettingType.SELECT,
		packageValue: 'balanced',
		values: [
			{ key: 'balanced', i18nLabel: 'strategy_balanced' },
			{ key: 'random', i18nLabel: 'strategy_random' },
		],
		required: true,
		public: false,
		i18nLabel: 'setting_draw_strategy',
		i18nDescription: 'setting_draw_strategy_description',
	},
	{
		id: 'group_teams',
		type: SettingType.BOOLEAN,
		packageValue: true,
		required: false,
		public: false,
		i18nLabel: 'setting_group_teams',
		i18nDescription: 'setting_group_teams_description',
	},
	{
		id: 'user_links',
		type: SettingType.STRING,
		multiline: true,
		packageValue: '',
		required: false,
		public: false,
		i18nLabel: 'setting_user_links',
		i18nDescription: 'setting_user_links_description',
	},
];

export function notAvailable(text: string, today: string): string[] {
	return text
		.split('\n')
		.map((line) => line.trim().match(/^@?(\S+)(?:\s+until\s+(\d{4}-\d{2}-\d{2}))?$/))
		.filter((match): match is RegExpMatchArray => !!match && !match[1].startsWith('#') && (!match[2] || match[2] >= today))
		.map((match) => match[1].toLowerCase());
}

export type Settings = {
	token: string;
	repos: string[];
	roomId: string;
	webhookToken: string;
	webhookActive: boolean;
	notAvailable: string[];
	groupTeams: boolean;
	strategy: 'balanced' | 'random';
};

export async function settings(read: IRead): Promise<Settings> {
	const reader = read.getEnvironmentReader().getSettings();
	const value = (id: string) => reader.getValueById(id);
	const room = await value('target_room');
	const first = Array.isArray(room) ? room[0] : room;
	const repos = String((await value('repositories')) ?? '')
		.split(/[\s,]+/)
		.filter(Boolean);
	return {
		token: (await value('github_token')) ?? '',
		repos: repos.length ? repos : ['RocketChat/Rocket.Chat'],
		roomId: (typeof first === 'string' ? first : first?._id) ?? '',
		webhookToken: (await value('webhook_token')) ?? '',
		webhookActive: Boolean(await value('webhook_active')),
		notAvailable: notAvailable(String((await value('not_available')) ?? ''), new Date().toISOString().slice(0, 10)),
		groupTeams: (await value('group_teams')) !== false,
		strategy: (await value('draw_strategy')) === 'random' ? 'random' : 'balanced',
	};
}
