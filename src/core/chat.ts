import type { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import type { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import type { IUser } from '@rocket.chat/apps-engine/definition/users';

import { settings } from './settings';
import type { Store } from './store';
import type { PrRecord } from './types';
import { buildCard } from '../card/blocks';

async function appUser(read: IRead): Promise<IUser> {
	const user = await read.getUserReader().getAppUser();
	if (!user) {
		throw new Error('App user not found');
	}
	return user;
}

export async function postOrUpdateCard(record: PrRecord, appId: string, modify: IModify, read: IRead): Promise<string> {
	const card = buildCard(record, appId, (await settings(read)).repos.length > 1);
	const sender = await appUser(read);
	if (record.cardMessageId) {
		const builder = await modify.getUpdater().message(record.cardMessageId, sender);
		builder.setText(card.text).setBlocks(card.blocks as never);
		await modify.getUpdater().finish(builder);
		return record.cardMessageId;
	}
	const room = await read.getRoomReader().getById(record.roomId);
	if (!room) {
		throw new Error(`Room ${record.roomId} not found`);
	}
	const builder = modify
		.getCreator()
		.startMessage()
		.setRoom(room)
		.setSender(sender)
		.setText(card.text)
		.setBlocks(card.blocks as never)
		.setParseUrls(false);
	return modify.getCreator().finish(builder);
}

export async function replyInThread(record: PrRecord, text: string, modify: IModify, read: IRead): Promise<void> {
	const room = await read.getRoomReader().getById(record.roomId);
	if (!room) {
		return;
	}
	const builder = modify
		.getCreator()
		.startMessage()
		.setRoom(room)
		.setSender(await appUser(read))
		.setThreadId(record.cardMessageId)
		.setText(text);
	await modify.getCreator().finish(builder);
}

export async function postInRoom(room: IRoom, text: string, modify: IModify, read: IRead): Promise<void> {
	const builder = modify
		.getCreator()
		.startMessage()
		.setRoom(room)
		.setSender(await appUser(read))
		.setText(text);
	await modify.getCreator().finish(builder);
}

export async function tellUser(user: IUser, room: IRoom, text: string, modify: IModify, read: IRead): Promise<void> {
	const notifier = modify.getNotifier();
	const message = notifier
		.getMessageBuilder()
		.setRoom(room)
		.setSender(await appUser(read))
		.setText(text)
		.getMessage();
	await notifier.notifyUser(user, message);
}

export async function saveAndNotify(
	record: PrRecord,
	appId: string,
	modify: IModify,
	read: IRead,
	store: Store,
	note: string,
): Promise<void> {
	await postOrUpdateCard(record, appId, modify, read);
	await store.savePr(record);
	await replyInThread(record, note, modify, read);
}
