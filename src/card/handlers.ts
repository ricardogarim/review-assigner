import type { App } from '@rocket.chat/apps-engine/definition/App';
import type { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import type {
	IUIKitResponse,
	UIKitBlockInteractionContext,
	UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';

import { ACTION_REASSIGN, ACTION_TAKE } from './blocks';
import type { CardContext } from './context';
import { canReassign, REASSIGN_REFUSED } from './permissions';
import { MODAL_PREFIX, reassignModal, reassignTarget, submitReassign } from './reassign';
import type { ReassignState } from './reassign';
import { take, TAKE_PREFIX, takeModal } from './take';
import { tellUser } from '../core/chat';
import { Store } from '../core/store';

export async function onBlockAction(
	app: App,
	context: UIKitBlockInteractionContext,
	read: IRead,
	http: IHttp,
	persis: IPersistence,
	modify: IModify,
): Promise<IUIKitResponse> {
	const data = context.getInteractionData();
	const responder = context.getInteractionResponder();
	const ctx: CardContext = { app, read, http, modify, store: new Store(read, persis) };
	const record = data.message?.id ? await ctx.store.getPrByMessage(data.message.id) : undefined;
	if (record?.state !== 'open') {
		return responder.successResponse();
	}
	const say = async (text: string | undefined) => {
		if (text && data.room) {
			await tellUser(data.user, data.room, text, modify, read);
		}
	};

	if (data.actionId === ACTION_TAKE) {
		const result = await take(ctx, record, data.user);
		if (typeof result === 'object') {
			return responder.openModalViewResponse(takeModal(record, result.choose, result.preselected, app.getID()) as never);
		}
		await say(result);
	}
	if (data.actionId === ACTION_REASSIGN) {
		if (await canReassign(record, data.user, ctx.store)) {
			return responder.openModalViewResponse(reassignModal(record, app.getID()) as never);
		}
		await say(REASSIGN_REFUSED);
	}
	return responder.successResponse();
}

export async function onViewSubmit(
	app: App,
	context: UIKitViewSubmitInteractionContext,
	read: IRead,
	http: IHttp,
	persis: IPersistence,
	modify: IModify,
): Promise<IUIKitResponse> {
	const data = context.getInteractionData();
	const responder = context.getInteractionResponder();
	const prefix = [MODAL_PREFIX, TAKE_PREFIX].find((p) => data.view.id.startsWith(p));
	if (!prefix) {
		return responder.successResponse();
	}
	const ctx: CardContext = { app, read, http, modify, store: new Store(read, persis) };
	const ref = data.view.id.slice(prefix.length);
	const hash = ref.lastIndexOf('#');
	const record = await ctx.store.getPr(ref.slice(0, hash), Number(ref.slice(hash + 1)));
	if (record?.state !== 'open') {
		return responder.successResponse();
	}
	const tell = async (text: string | undefined) => {
		const room = text && (await read.getRoomReader().getById(record.roomId));
		if (text && room) {
			await tellUser(data.user, room, text, modify, read);
		}
	};

	if (prefix === TAKE_PREFIX) {
		const chosen = (data.view.state as { teams?: { teams?: string[] } } | undefined)?.teams?.teams ?? [];
		const result = await take(ctx, record, data.user, chosen);
		await tell(typeof result === 'string' ? result : undefined);
		return responder.successResponse();
	}

	const state = (data.view.state ?? {}) as ReassignState;
	const target = reassignTarget(record, state);
	if (!target) {
		return responder.successResponse();
	}
	if (!(await canReassign(record, data.user, ctx.store))) {
		await tell(REASSIGN_REFUSED);
		return responder.successResponse();
	}
	const errors = await submitReassign(ctx, record, target, state, data.user);
	return errors ? responder.viewErrorResponse({ viewId: data.view.id, errors }) : responder.successResponse();
}
