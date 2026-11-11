import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { getProfiles, rizamoRequest, splitList } from '../Rizamo/GenericFunctions';

/** Rizamo's event types (WebhookEventType). */
const EVENTS: Array<{ name: string; value: string; description: string }> = [
	{ name: 'Account Connected', value: 'account.connected', description: 'A social account was connected' },
	{ name: 'Account Disconnected', value: 'account.disconnected', description: 'An account needs to be reconnected' },
	{ name: 'Account Removed', value: 'account.removed', description: 'An account was removed from Rizamo' },
	{ name: 'Account Updated', value: 'account.updated', description: "An account's details changed" },
	{ name: 'Comment Automation Failed', value: 'comment_automation.failed', description: 'An automated message did not go out' },
	{ name: 'Comment Automation Paused', value: 'comment_automation.paused', description: 'A comment automation was paused' },
	{ name: 'Comment Automation Sent', value: 'comment_automation.sent', description: 'A comment automation sent its message' },
	{ name: 'Comment Received', value: 'comment.received', description: 'A new comment arrived in the inbox' },
	{ name: 'Message Received', value: 'message.received', description: 'A new private message arrived in the inbox' },
	{ name: 'Message Sent', value: 'message.sent', description: 'A reply went out from the inbox' },
	{ name: 'Post Created', value: 'post.created', description: 'A post was created' },
	{ name: 'Post Deleted', value: 'post.deleted', description: 'A post was deleted' },
	{ name: 'Post Failed', value: 'post.failed', description: 'A post failed on every account' },
	{ name: 'Post Published', value: 'post.published', description: 'A post went out' },
	{ name: 'Post Restored', value: 'post.restored', description: 'A deleted post was restored' },
	{ name: 'Post Scheduled', value: 'post.scheduled', description: 'A post was scheduled' },
	{ name: 'Post Target Deleted', value: 'post.target.deleted', description: 'A post was deleted from one network' },
	{ name: 'Post Target Failed', value: 'post.target.failed', description: 'A post failed on one account' },
	{ name: 'Post Target Published', value: 'post.target.published', description: 'A post went out on one account' },
	{ name: 'Post Target Updated', value: 'post.target.updated', description: "A post's details on one network changed" },
	{ name: 'Post Unscheduled', value: 'post.unscheduled', description: 'A scheduled post went back to draft' },
	{ name: 'Post Updated', value: 'post.updated', description: 'A post was edited' },
];

/** Older than this, a delivery is refused as a replay (Standard Webhooks). */
const TOLERANCE_SECONDS = 300;

function header(headers: IDataObject, name: string): string {
	const value = headers[name];
	return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

/** Rizamo's `webhook-signature`: `v1,` and the base64 HMAC-SHA256 of `<id>.<timestamp>.<body>`, keyed with the secret. */
export function verifySignature(secret: string, headers: IDataObject, body: string, now = Date.now()): boolean {
	const id = header(headers, 'webhook-id');
	const timestamp = Number(header(headers, 'webhook-timestamp'));
	if (!id || !Number.isFinite(timestamp)) return false;
	if (Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
	const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
	const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
	return header(headers, 'webhook-signature')
		.split(' ')
		.some((part) => {
			const given = Buffer.from(part.split(',')[1] ?? '', 'base64');
			return part.startsWith('v1,') && given.length === expected.length && timingSafeEqual(given, expected);
		});
}

export class RizamoTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rizamo Trigger',
		name: 'rizamoTrigger',
		icon: { light: 'file:../Rizamo/rizamo.svg', dark: 'file:../Rizamo/rizamo.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in Rizamo: a post goes out or fails, a comment or message arrives',
		defaults: { name: 'Rizamo Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'rizamoApi', required: true }],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: EVENTS,
				default: ['post.published'],
				description: 'The events that start the workflow',
			},
			{
				displayName: 'Profile Names or IDs',
				name: 'profileIds',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: [],
				description:
					'Only events of these profiles. Left empty, every profile\'s. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = {
		loadOptions: { getProfiles },
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (!data.webhookId) return false;
				const { items } = (await rizamoRequest.call(this, 'GET', '/webhooks')) as { items: IDataObject[] };
				const found = items.find((w) => w.id === data.webhookId);
				if (found && found.url === this.getNodeWebhookUrl('default')) return true;
				delete data.webhookId;
				delete data.secret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const events = this.getNodeParameter('events') as string[];
				const profileIds = splitList(this.getNodeParameter('profileIds', []));
				const workflow = this.getWorkflow();
				const body: IDataObject = {
					url: this.getNodeWebhookUrl('default'),
					description: `n8n: ${workflow.name ?? `workflow ${workflow.id ?? ''}`}`.slice(0, 200),
					events,
					profileIds: profileIds.length ? profileIds : null,
				};
				const created = (await rizamoRequest.call(this, 'POST', '/webhooks', body)) as {
					endpoint: IDataObject;
					secret: string;
				};
				const data = this.getWorkflowStaticData('node');
				data.webhookId = created.endpoint.id;
				data.secret = created.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.webhookId) {
					try {
						await rizamoRequest.call(this, 'DELETE', `/webhooks/${encodeURIComponent(String(data.webhookId))}`);
					} catch (error) {
						// Already gone (deleted in Rizamo): nothing left to remove.
						if ((error as { httpCode?: string }).httpCode !== '404') return false;
					}
				}
				delete data.webhookId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const data = this.getWorkflowStaticData('node');
		const request = this.getRequestObject() as unknown as { rawBody?: Buffer | string };
		const raw =
			request.rawBody !== undefined ? request.rawBody.toString() : JSON.stringify(this.getBodyData());
		const secret = typeof data.secret === 'string' ? data.secret : '';
		if (!secret || !verifySignature(secret, this.getHeaderData() as IDataObject, raw)) {
			const response = this.getResponseObject();
			response.status(401).send('The signature does not match this workflow\'s Rizamo webhook').end();
			return { noWebhookResponse: true };
		}
		return { workflowData: [this.helpers.returnJsonArray(this.getBodyData())] };
	}
}
