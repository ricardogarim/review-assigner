import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IConfigurationModify } from '@rocket.chat/apps-engine/definition/accessors';
import type { IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';

import { updatePr } from './update-pr';
import { Store } from '../core/store';

const POLL_JOB = 'poll';

export function pollProcessor(app: App): IProcessor {
	return {
		id: POLL_JOB,
		processor: async (_context, read, modify, http, persis) => {
			for (const record of await new Store(read).listOpenPrs()) {
				try {
					await updatePr(app, record.repo, record.number, read, modify, http, persis);
				} catch (error) {
					app.getLogger().error(`Poll of ${record.repo}#${record.number} failed`, error);
				}
			}
		},
	};
}

export async function schedulePolling(configurationModify: IConfigurationModify, webhookActive: boolean): Promise<void> {
	await configurationModify.scheduler.cancelJob(POLL_JOB);
	await configurationModify.scheduler.scheduleRecurring({ id: POLL_JOB, interval: webhookActive ? '60 minutes' : '5 minutes' });
}
