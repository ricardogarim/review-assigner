import { App } from '@rocket.chat/apps-engine/definition/App';
import type {
	IAppAccessors,
	IConfigurationExtend,
	IConfigurationModify,
	IEnvironmentRead,
	IHttp,
	ILogger,
	IModify,
	IPersistence,
	IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import type { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import type { ISetting } from '@rocket.chat/apps-engine/definition/settings';
import type {
	IUIKitResponse,
	UIKitBlockInteractionContext,
	UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';

import { onBlockAction, onViewSubmit } from './src/card/handlers';
import { SETTINGS } from './src/core/settings';
import { parseUserLinks } from './src/core/store';
import { pollProcessor, schedulePolling } from './src/github/poll';
import { GitHubWebhook } from './src/github/webhook';
import { ReviewCommand } from './src/review/command';

export class ReviewAssignerApp extends App {
	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	protected async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
		for (const setting of SETTINGS) {
			await configuration.settings.provideSetting(setting);
		}
		await configuration.slashCommands.provideSlashCommand(new ReviewCommand(this));
		await configuration.api.provideApi({
			visibility: ApiVisibility.PUBLIC,
			security: ApiSecurity.UNSECURE,
			endpoints: [new GitHubWebhook(this)],
		});
		await configuration.scheduler.registerProcessors([pollProcessor(this)]);
	}

	public async onEnable(environment: IEnvironmentRead, configurationModify: IConfigurationModify): Promise<boolean> {
		await schedulePolling(configurationModify, Boolean(await environment.getSettings().getValueById('webhook_active')));
		return true;
	}

	public async onSettingUpdated(setting: ISetting, configurationModify: IConfigurationModify, read: IRead): Promise<void> {
		if (setting.id === 'webhook_active') {
			await schedulePolling(configurationModify, Boolean(setting.value));
		}
		if (setting.id === 'user_links') {
			for (const line of parseUserLinks(String(setting.value ?? ''))) {
				if (!(await read.getUserReader().getByUsername(line.rcUsername))) {
					this.getLogger().warn(`User links: no Rocket.Chat user "${line.rcUsername}", line skipped`);
				}
			}
		}
	}

	public async executeBlockActionHandler(
		context: UIKitBlockInteractionContext,
		read: IRead,
		http: IHttp,
		persistence: IPersistence,
		modify: IModify,
	): Promise<IUIKitResponse> {
		return onBlockAction(this, context, read, http, persistence, modify);
	}

	public async executeViewSubmitHandler(
		context: UIKitViewSubmitInteractionContext,
		read: IRead,
		http: IHttp,
		persistence: IPersistence,
		modify: IModify,
	): Promise<IUIKitResponse> {
		return onViewSubmit(this, context, read, http, persistence, modify);
	}
}
