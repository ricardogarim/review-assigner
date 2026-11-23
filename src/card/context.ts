import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';

import type { Store } from '../core/store';

export type CardContext = { app: App; read: IRead; http: IHttp; modify: IModify; store: Store };
