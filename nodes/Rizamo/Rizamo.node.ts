import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { accountFields, accountOperations, profileFields, profileOperations } from './descriptions/AccountDescription';
import { analyticsFields, analyticsOperations } from './descriptions/AnalyticsDescription';
import { commentFields, commentOperations, threadFields, threadOperations } from './descriptions/InboxDescription';
import { linkFields, linkOperations } from './descriptions/LinkDescription';
import { mediaFields, mediaOperations } from './descriptions/MediaDescription';
import { postFields, postOperations } from './descriptions/PostDescription';
import {
	getAccounts,
	getProfiles,
	idempotencyKey,
	importUrl,
	rizamoRequest,
	rizamoNodeError,
	rizamoRequestAllItems,
	splitList,
	uploadBinary,
} from './GenericFunctions';

const id = (value: unknown) => encodeURIComponent(String(value).trim());

/** n8n's date fields come as ISO strings; Rizamo's analytics take the day alone. */
const day = (value: unknown) => (typeof value === 'string' && value ? value.slice(0, 10) : undefined);

/** Network options as the API takes them, only those the user added. */
function networkOptions(this: IExecuteFunctions, i: number): Record<string, IDataObject> {
	const tiktok = { ...(this.getNodeParameter('tiktokOptions', i, {}) as IDataObject) };
	if (tiktok.consent !== true) delete tiktok.consent;
	if (tiktok.title === '') delete tiktok.title;

	const instagram = { ...(this.getNodeParameter('instagramOptions', i, {}) as IDataObject) };
	if (instagram.collaborators !== undefined) instagram.collaborators = splitList(instagram.collaborators).slice(0, 3);

	const youtube = { ...(this.getNodeParameter('youtubeOptions', i, {}) as IDataObject) };
	if (youtube.tags !== undefined) youtube.tags = splitList(youtube.tags);
	for (const key of ['title', 'categoryId']) if (youtube[key] === '') delete youtube[key];

	const facebook = { ...(this.getNodeParameter('facebookOptions', i, {}) as IDataObject) };
	if (facebook.link === '') delete facebook.link;

	const threads = { ...(this.getNodeParameter('threadsOptions', i, {}) as IDataObject) };
	for (const key of ['linkAttachment', 'topicTag']) if (threads[key] === '') delete threads[key];

	return { tiktok, instagram, youtube, facebook, threads };
}

async function createPost(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const profileId = this.getNodeParameter('profileId', i) as string;
	// A list, or IDs separated by commas when an expression maps them from a sheet.
	const accountIds = splitList(this.getNodeParameter('accountIds', i));
	const text = this.getNodeParameter('text', i) as string;
	const when = this.getNodeParameter('when', i) as string;
	const mediaSource = this.getNodeParameter('mediaSource', i) as string;
	const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	if (!accountIds.length) {
		throw new NodeOperationError(this.getNode(), 'Choose at least one account', { itemIndex: i });
	}

	const mediaExtra: IDataObject = { profileId, ...(additional.alt ? { alt: additional.alt } : {}) };
	let mediaIds: string[] = [];
	if (mediaSource === 'binary') {
		for (const name of splitList(this.getNodeParameter('binaryPropertyName', i))) {
			const media = await uploadBinary.call(this, i, name, mediaExtra);
			mediaIds.push(String(media.id));
		}
	} else if (mediaSource === 'urls') {
		for (const url of splitList(this.getNodeParameter('mediaUrls', i))) {
			const media = await importUrl.call(this, i, url, mediaExtra);
			mediaIds.push(String(media.id));
		}
	} else if (mediaSource === 'ids') {
		mediaIds = splitList(this.getNodeParameter('mediaIds', i));
	}

	// Each target takes the options of its own network only.
	const accounts = await rizamoRequestAllItems.call(this, '/accounts', { profileId });
	const networkOf = new Map(accounts.map((a) => [String(a.id), String(a.network)]));
	const options = networkOptions.call(this, i);
	const targets = accountIds.map((accountId) => {
		const target: IDataObject = { accountId };
		if (additional.format) target.format = additional.format;
		if (additional.firstComment) target.firstComment = additional.firstComment;
		const network = networkOf.get(accountId);
		if (network && options[network] && Object.keys(options[network]).length) {
			target.options = { [network]: options[network] };
		}
		return target;
	});

	const body: IDataObject = { profileId, text, targets };
	if (mediaIds.length) body.mediaIds = mediaIds;
	if (additional.timeZone) body.timeZone = additional.timeZone;
	if (when === 'schedule') {
		body.status = 'scheduled';
		body.scheduledAt = this.getNodeParameter('scheduledAt', i) as string;
	} else if (when === 'queue') {
		body.queue = true;
	} else {
		body.status = 'draft';
	}

	const post = (await rizamoRequest.call(
		this,
		'POST',
		'/posts',
		body,
		undefined,
		idempotencyKey.call(this, i, 'post', body),
	)) as IDataObject;
	if (when !== 'now') return post;
	return (await rizamoRequest.call(
		this,
		'POST',
		`/posts/${id(post.id)}/publish`,
		undefined,
		undefined,
		idempotencyKey.call(this, i, 'publish', post.id),
	)) as IDataObject;
}

/** The analytics period and options as query parameters. */
function analyticsQuery(this: IExecuteFunctions, i: number): IDataObject {
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const qs: IDataObject = { ...options };
	if (this.getNodeParameter('period', i) === 'range') {
		qs.from = day(this.getNodeParameter('from', i));
		qs.to = day(this.getNodeParameter('to', i, ''));
	} else {
		qs.days = this.getNodeParameter('days', i);
	}
	return qs;
}

export class Rizamo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rizamo',
		name: 'rizamo',
		icon: { light: 'file:rizamo.svg', dark: 'file:rizamo.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Publish and schedule social posts on Instagram, Facebook, TikTok, YouTube and Threads, answer comments and messages, and read analytics',
		defaults: { name: 'Rizamo' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'rizamoApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Analytic', value: 'analytics' },
					{ name: 'Comment', value: 'comment' },
					{ name: 'Inbox Thread', value: 'thread' },
					{ name: 'Link', value: 'link' },
					{ name: 'Media', value: 'media' },
					{ name: 'Post', value: 'post' },
					{ name: 'Profile', value: 'profile' },
				],
				default: 'post',
			},
			...postOperations,
			...postFields,
			...mediaOperations,
			...mediaFields,
			...accountOperations,
			...accountFields,
			...profileOperations,
			...profileFields,
			...analyticsOperations,
			...analyticsFields,
			...threadOperations,
			...threadFields,
			...commentOperations,
			...commentFields,
			...linkOperations,
			...linkFields,
		],
	};

	methods = {
		loadOptions: { getProfiles, getAccounts },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let result: IDataObject | IDataObject[];

				if (resource === 'post') {
					if (operation === 'create') {
						result = await createPost.call(this, i);
					} else if (operation === 'getAll') {
						const filters = { ...(this.getNodeParameter('filters', i, {}) as IDataObject) };
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
						result = await rizamoRequestAllItems.call(
							this,
							'/posts',
							{ ...filters, limit: Math.min(limit ?? 200, 200) },
							limit,
						);
					} else {
						const postId = id(this.getNodeParameter('postId', i));
						if (operation === 'get') {
							result = await rizamoRequest.call(this, 'GET', `/posts/${postId}`);
						} else if (operation === 'publish') {
							result = await rizamoRequest.call(
								this,
								'POST',
								`/posts/${postId}/publish`,
								undefined,
								undefined,
								idempotencyKey.call(this, i, 'publish', postId),
							);
						} else if (operation === 'delete') {
							result = await rizamoRequest.call(this, 'DELETE', `/posts/${postId}`);
						} else {
							throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, { itemIndex: i });
						}
					}
				} else if (resource === 'media') {
					if (operation === 'upload') {
						const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
						result = await uploadBinary.call(this, i, this.getNodeParameter('binaryPropertyName', i) as string, extra);
					} else if (operation === 'importUrl') {
						const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
						result = await importUrl.call(this, i, this.getNodeParameter('url', i) as string, extra);
					} else {
						result = await rizamoRequest.call(this, 'GET', `/media/${id(this.getNodeParameter('mediaId', i))}`);
					}
				} else if (resource === 'account') {
					if (operation === 'getAll') {
						const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
						result = await rizamoRequestAllItems.call(this, '/accounts', { ...filters, limit }, limit);
					} else if (operation === 'getTiktokCreatorInfo') {
						result = await rizamoRequest.call(
							this,
							'GET',
							`/accounts/${id(this.getNodeParameter('accountId', i))}/tiktok/creator-info`,
						);
					} else {
						result = await rizamoRequest.call(this, 'GET', `/accounts/${id(this.getNodeParameter('accountId', i))}`);
					}
				} else if (resource === 'profile') {
					const { items: profiles } = (await rizamoRequest.call(this, 'GET', '/profiles')) as { items: IDataObject[] };
					if (operation === 'getAll') {
						result = profiles;
					} else {
						const profileId = String(this.getNodeParameter('profileId', i));
						const found = profiles.find((p) => p.id === profileId);
						if (!found) {
							throw new NodeOperationError(this.getNode(), `No profile ${profileId} that this API key reaches`, {
								itemIndex: i,
							});
						}
						result = found;
					}
				} else if (resource === 'analytics') {
					const qs = analyticsQuery.call(this, i);
					if (operation === 'getOverview') {
						result = await rizamoRequest.call(this, 'GET', '/analytics/overview', undefined, qs);
					} else {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
						const posts: IDataObject[] = [];
						let offset = 0;
						for (;;) {
							const page = (await rizamoRequest.call(this, 'GET', '/analytics/posts', undefined, {
								...qs,
								limit: Math.min(100, limit - posts.length),
								offset,
							})) as { items: IDataObject[]; total: number };
							posts.push(...page.items);
							offset += page.items.length;
							if (!page.items.length || posts.length >= limit || offset >= page.total) break;
						}
						result = posts;
					}
				} else if (resource === 'thread') {
					if (operation === 'getAll') {
						const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
						result = await rizamoRequestAllItems.call(
							this,
							'/inbox/threads',
							{ ...filters, status: this.getNodeParameter('status', i), limit: Math.min(limit ?? 200, 200) },
							limit,
						);
					} else {
						const threadId = id(this.getNodeParameter('threadId', i));
						if (operation === 'get') {
							const messagesLimit = this.getNodeParameter('messagesLimit', i, 0) as number;
							result = await rizamoRequest.call(this, 'GET', `/inbox/threads/${threadId}`, undefined, {
								limit: messagesLimit > 0 ? messagesLimit : undefined,
							});
						} else if (operation === 'reply') {
							const body = { text: this.getNodeParameter('text', i) as string };
							result = await rizamoRequest.call(
								this,
								'POST',
								`/inbox/threads/${threadId}/messages`,
								body,
								undefined,
								idempotencyKey.call(this, i, `reply-${threadId}`, body),
							);
						} else {
							result = await rizamoRequest.call(this, 'PATCH', `/inbox/threads/${threadId}`, { status: 'done' });
						}
					}
				} else if (resource === 'comment') {
					const path = `/inbox/threads/${id(this.getNodeParameter('threadId', i))}/messages/${id(
						this.getNodeParameter('messageId', i),
					)}`;
					result =
						operation === 'delete'
							? await rizamoRequest.call(this, 'DELETE', path)
							: await rizamoRequest.call(this, 'PATCH', path, { hidden: operation === 'hide' });
				} else if (resource === 'link') {
					if (operation === 'create') {
						const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
						const utm: IDataObject = {};
						for (const [field, key] of [
							['utmSource', 'source'],
							['utmMedium', 'medium'],
							['utmCampaign', 'campaign'],
							['utmTerm', 'term'],
							['utmContent', 'content'],
						]) {
							if (extra[field]) utm[key] = extra[field];
						}
						const body: IDataObject = { url: this.getNodeParameter('url', i) as string };
						if (Object.keys(utm).length) body.utm = utm;
						if (extra.profileId) body.profileId = extra.profileId;
						if (extra.expiresAt) body.expiresAt = new Date(String(extra.expiresAt)).toISOString();
						result = await rizamoRequest.call(
							this,
							'POST',
							'/links',
							body,
							undefined,
							idempotencyKey.call(this, i, 'link', body),
						);
					} else {
						result = await rizamoRequest.call(this, 'GET', `/links/${id(this.getNodeParameter('linkId', i))}`);
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, { itemIndex: i });
				}

				const executionData = this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(result), {
					itemData: { item: i },
				});
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, {
						itemIndex: i,
						description: error.description ?? undefined,
					});
				}
				throw rizamoNodeError(this.getNode(), error, undefined, i);
			}
		}

		return [returnData];
	}
}
