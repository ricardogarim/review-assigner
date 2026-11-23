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
import { take } from './take';
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
		await say(await take(ctx, record, data.user));
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
	if (!data.view.id.startsWith(MODAL_PREFIX)) {
		return responder.successResponse();
	}
	const ctx: CardContext = { app, read, http, modify, store: new Store(read, persis) };
	const ref = data.view.id.slice(MODAL_PREFIX.length);
	const hash = ref.lastIndexOf('#');
	const record = await ctx.store.getPr(ref.slice(0, hash), Number(ref.slice(hash + 1)));
	const state = (data.view.state ?? {}) as ReassignState;
	const target = record && reassignTarget(record, state);
	if (record?.state !== 'open' || !target) {
		return responder.successResponse();
	}
	if (!(await canReassign(record, data.user, ctx.store))) {
		const room = await read.getRoomReader().getById(record.roomId);
		if (room) {
			await tellUser(data.user, room, REASSIGN_REFUSED, modify, read);
		}
		return responder.successResponse();
	}
	const errors = await submitReassign(ctx, record, target, state, data.user);
	return errors ? responder.viewErrorResponse({ viewId: data.view.id, errors }) : responder.successResponse();
}
