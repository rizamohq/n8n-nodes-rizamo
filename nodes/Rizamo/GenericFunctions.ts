import { createHash } from 'crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodePropertyOptions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

type Context = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

const DEFAULT_BASE_URL = 'https://api.rizamo.com/v1';

/** The file types Rizamo takes (POST /media). */
const CONTENT_TYPES: Record<string, string> = {
	'image/jpeg': 'image/jpeg',
	'image/jpg': 'image/jpeg',
	'image/pjpeg': 'image/jpeg',
	'image/png': 'image/png',
	'image/webp': 'image/webp',
	'video/mp4': 'video/mp4',
	'video/quicktime': 'video/quicktime',
};

const BY_EXTENSION: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
};

/** Rizamo answers errors as `{ error: { code, message } }`: find that message wherever n8n kept the body. */
function rizamoError(error: unknown): { message?: string; code?: string } {
	const candidates: unknown[] = [];
	const e = error as IDataObject | undefined;
	const response = e?.response as IDataObject | undefined;
	const cause = e?.cause as IDataObject | undefined;
	// n8n wraps a failed request in a NodeApiError that keeps the body in `context.data`.
	candidates.push(
		(e?.context as IDataObject | undefined)?.data,
		response?.data,
		response?.body,
		(cause?.response as IDataObject | undefined)?.data,
		e?.error,
	);
	for (const candidate of candidates) {
		let body = candidate;
		if (typeof body === 'string') {
			try {
				body = JSON.parse(body);
			} catch {
				continue;
			}
		}
		// `{ error: { code, message } }`, or the bare `{ code, message }` of a local test server.
		const inner = ((body as IDataObject | undefined)?.error ?? body) as IDataObject | undefined;
		if (inner && typeof inner === 'object' && typeof inner.message === 'string') {
			return { message: inner.message, code: typeof inner.code === 'string' ? inner.code : undefined };
		}
	}
	// n8n put the body's message in the description and a generic one in the message.
	if (e instanceof NodeApiError && typeof e.description === 'string' && e.description) {
		return { message: e.description };
	}
	return {};
}

function withoutEmpty(values: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

export async function rizamoRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	idempotencyKey?: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	const credentials = await this.getCredentials('rizamoApi');
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
		headers: {},
	};
	if (body !== undefined) options.body = body;
	if (qs) options.qs = withoutEmpty(qs);
	if (idempotencyKey) options.headers = { ...options.headers, 'Idempotency-Key': idempotencyKey };
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'rizamoApi', options);
	} catch (error) {
		throw rizamoNodeError(this.getNode(), error);
	}
}

/**
 * The error n8n shows, with Rizamo's own message as its title. n8n already wraps a failed request in a NodeApiError,
 * and wrapping one again hands back the same error with its options ignored, so the message is set on it directly.
 */
export function rizamoNodeError(node: INode, error: unknown, fallback?: string, itemIndex?: number): NodeApiError {
	const { message, code } = rizamoError(error);
	const title = message ?? fallback;
	const description = code ? `Rizamo error code: ${code}` : undefined;
	if (error instanceof NodeApiError) {
		if (title) error.message = title;
		error.description = description ?? (error.description === title ? null : error.description);
		if (itemIndex !== undefined) error.context.itemIndex = itemIndex;
		return error;
	}
	return new NodeApiError(node, error as JsonObject, {
		...(title ? { message: title } : {}),
		...(description ? { description } : {}),
		...(itemIndex !== undefined ? { itemIndex } : {}),
	});
}

/** Every item of a list that pages with `nextCursor`, up to `limit` when given. */
export async function rizamoRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	path: string,
	qs: IDataObject = {},
	limit?: number,
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	let cursor: string | undefined;
	do {
		const page = (await rizamoRequest.call(this, 'GET', path, undefined, { ...qs, cursor })) as {
			items: IDataObject[];
			nextCursor?: string | null;
		};
		items.push(...page.items);
		if (limit !== undefined && items.length >= limit) return items.slice(0, limit);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return items;
}

/**
 * A key for one write of one item, the same when n8n tries the node again in this execution: Rizamo then answers
 * with the first result instead of posting twice. The body's hash keeps different writes apart in loops.
 */
export function idempotencyKey(this: IExecuteFunctions, itemIndex: number, step: string, body: unknown): string {
	const hash = createHash('sha256')
		.update(JSON.stringify(body ?? null))
		.digest('hex')
		.slice(0, 16);
	return `n8n-${String(this.getExecutionId())}-${this.getNode().id}-${itemIndex}-${step}-${hash}`.slice(0, 255);
}

export function splitList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	if (typeof value !== 'string') return [];
	return value
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
}

function contentTypeOf(mimeType: string | undefined, fileName: string | undefined): string | undefined {
	const byType = mimeType ? CONTENT_TYPES[mimeType.toLowerCase().split(';')[0].trim()] : undefined;
	if (byType) return byType;
	const extension = fileName?.split('.').pop()?.toLowerCase();
	return extension ? BY_EXTENSION[extension] : undefined;
}

/** Uploads a binary property of an item: create the media, put each part, complete it when there are several. */
export async function uploadBinary(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
	extra: IDataObject = {},
): Promise<IDataObject> {
	const binary = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
	const contentType = contentTypeOf(binary.mimeType, binary.fileName);
	if (!contentType) {
		throw new NodeOperationError(
			this.getNode(),
			`Rizamo takes JPEG, PNG, WebP, MP4 or MOV files, and "${binaryPropertyName}" is ${binary.mimeType || 'of an unknown type'}`,
			{ itemIndex },
		);
	}
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const body = withoutEmpty({ ...extra, contentType, size: buffer.length });
	const created = (await rizamoRequest.call(
		this,
		'POST',
		'/media',
		body,
		undefined,
		idempotencyKey.call(this, itemIndex, `media-${binaryPropertyName}`, body),
	)) as {
		media: IDataObject;
		upload: null | {
			parts: Array<{ url: string; headers: Record<string, string>; size: number }>;
			complete: null | { url: string };
		};
	};
	if (!created.upload) return created.media;

	// n8n trying the node again gets the first answer back (same idempotency key): the file may be up already.
	const mediaPath = `/media/${encodeURIComponent(String(created.media.id))}`;
	const current = (await rizamoRequest.call(this, 'GET', mediaPath)) as IDataObject;
	if (current.status === 'ready') return current;

	let answer: unknown;
	let offset = 0;
	try {
		for (const part of created.upload.parts) {
			answer = await this.helpers.httpRequest({
				method: 'PUT',
				url: part.url,
				headers: part.headers,
				body: buffer.subarray(offset, offset + part.size),
			});
			offset += part.size;
		}
		if (created.upload.complete) {
			answer = await this.helpers.httpRequest({ method: 'POST', url: created.upload.complete.url, json: true });
		}
	} catch (error) {
		throw rizamoNodeError(this.getNode(), error, `Uploading "${binaryPropertyName}" to Rizamo failed`, itemIndex);
	}

	let done = answer as { media?: IDataObject; error?: string | null } | string | undefined;
	if (typeof done === 'string') {
		try {
			done = JSON.parse(done) as { media?: IDataObject; error?: string | null };
		} catch {
			done = undefined;
		}
	}
	if (done && typeof done === 'object' && done.error) {
		throw new NodeOperationError(this.getNode(), done.error, { itemIndex });
	}
	if (done && typeof done === 'object' && done.media) return done.media;
	return (await rizamoRequest.call(this, 'GET', mediaPath)) as IDataObject;
}

/** Imports a file Rizamo downloads from a public address. */
export async function importUrl(
	this: IExecuteFunctions,
	itemIndex: number,
	url: string,
	extra: IDataObject = {},
): Promise<IDataObject> {
	const body = withoutEmpty({ ...extra, url });
	const created = (await rizamoRequest.call(
		this,
		'POST',
		'/media',
		body,
		undefined,
		idempotencyKey.call(this, itemIndex, 'media-url', body),
	)) as { media: IDataObject };
	return created.media;
}

const NETWORK_NAMES: Record<string, string> = {
	instagram: 'Instagram',
	facebook: 'Facebook',
	threads: 'Threads',
	tiktok: 'TikTok',
	youtube: 'YouTube',
	linkedin: 'LinkedIn',
	pinterest: 'Pinterest',
	x: 'X',
	google: 'Google Business Profile',
};

export function accountLabel(account: IDataObject): string {
	const network = NETWORK_NAMES[String(account.network)] ?? String(account.network);
	const handle = account.handle ? `@${String(account.handle).replace(/^@/, '')}` : String(account.name ?? account.id);
	return `${network} ${handle}`;
}

export async function getProfiles(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { items } = (await rizamoRequest.call(this, 'GET', '/profiles')) as { items: IDataObject[] };
	return items
		.map((p) => ({ name: String(p.name), value: String(p.id) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	let profileId: unknown;
	try {
		profileId = this.getCurrentNodeParameter('profileId');
	} catch {
		profileId = undefined;
	}
	const items = await rizamoRequestAllItems.call(this, '/accounts', {
		profileId: typeof profileId === 'string' && profileId.startsWith('prof_') ? profileId : undefined,
	});
	return items
		.map((a) => ({ name: accountLabel(a), value: String(a.id), description: String(a.status ?? '') }))
		.sort((a, b) => a.name.localeCompare(b.name));
}
