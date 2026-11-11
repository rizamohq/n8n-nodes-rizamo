// Runs the built nodes against a Rizamo API with a real key (Rizamo's staging, from GitHub Actions):
//   RIZAMO_API_KEY=rz_live_... RIZAMO_API_URL=https://api-staging.rizamo.com/v1 node test/staging.cjs
// Against the web app's local demo: RIZAMO_API_KEY=any RIZAMO_API_URL=http://localhost:5173/api/v1 RIZAMO_DEMO=1
// It reads, uploads a file, creates draft posts and deletes them. It never publishes, replies or deletes anything else.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const KEY = process.env.RIZAMO_API_KEY;
const BASE = (process.env.RIZAMO_API_URL || 'https://api-staging.rizamo.com/v1').replace(
	/\/+$/,
	'',
);
if (!KEY) {
	console.log('RIZAMO_API_KEY is not set: skipped.');
	process.exit(0);
}

const { Rizamo } = require(path.join(__dirname, '../dist/nodes/Rizamo/Rizamo.node.js'));
const { verifySignature } = require(
	path.join(__dirname, '../dist/nodes/RizamoTrigger/RizamoTrigger.node.js'),
);

// A 64 by 64 PNG, made here so the test needs no file.
function png() {
	const crcTable = Array.from({ length: 256 }, (_, n) => {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		return c >>> 0;
	});
	const crc = (buf) => {
		let c = 0xffffffff;
		for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
	const chunk = (type, data) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type), data]);
		const sum = Buffer.alloc(4);
		sum.writeUInt32BE(crc(body));
		return Buffer.concat([len, body, sum]);
	};
	const size = 64;
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	const rows = [];
	for (let y = 0; y < size; y++)
		rows.push(Buffer.from([0, ...Array(size).fill([91, 61, 245]).flat()]));
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', require('node:zlib').deflateSync(Buffer.concat(rows))),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

async function httpRequest(opts) {
	const url = new URL(opts.url);
	for (const [k, v] of Object.entries(opts.qs || {}))
		if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
	const headers = { ...(opts.headers || {}) };
	let body;
	if (Buffer.isBuffer(opts.body)) body = opts.body;
	else if (opts.body !== undefined) {
		body = JSON.stringify(opts.body);
		headers['content-type'] = 'application/json';
	}
	const res = await fetch(url, { method: opts.method || 'GET', headers, body });
	const text = await res.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = text;
	}
	if (!res.ok) {
		const err = new Error(`Request failed with status code ${res.status}`);
		err.response = { status: res.status, data };
		err.httpCode = String(res.status);
		throw err;
	}
	return data;
}

let executionId = `staging-${Date.now()}`;
function context(params, items = [{ json: {} }]) {
	return {
		getInputData: () => items,
		getNodeParameter: (name, _i, fallback) =>
			params[name] === undefined ? fallback : params[name],
		getNode: () => ({
			id: 'staging-check',
			name: 'Rizamo',
			type: 'rizamo',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getExecutionId: () => executionId,
		getCredentials: async () => ({ apiKey: KEY, baseUrl: BASE }),
		continueOnFail: () => false,
		helpers: {
			httpRequest,
			httpRequestWithAuthentication: async (_type, o) =>
				httpRequest({ ...o, headers: { ...o.headers, Authorization: `Bearer ${KEY}` } }),
			assertBinaryData: (i, name) => items[i].binary[name],
			getBinaryDataBuffer: async (i, name) => Buffer.from(items[i].binary[name].data, 'base64'),
			returnJsonArray: (d) => (Array.isArray(d) ? d : [d]).map((json) => ({ json })),
			constructExecutionMetaData: (d, meta) => d.map((x) => ({ ...x, pairedItem: meta.itemData })),
		},
	};
}

async function run(label, params, items) {
	const [out] = await new Rizamo().execute.call(context(params, items));
	console.log(`ok  ${label}: ${out.length} item(s)`);
	return out.map((o) => o.json);
}

(async () => {
	const profiles = await run('profiles', { resource: 'profile', operation: 'getAll' });
	assert.ok(profiles.length, 'the key reaches no profile');
	const accounts = await run('accounts', {
		resource: 'account',
		operation: 'getAll',
		returnAll: true,
		filters: {},
	});
	const account =
		accounts.find(
			(a) => a.status === 'connected' && ['instagram', 'facebook', 'threads'].includes(a.network),
		) ?? accounts.find((a) => a.status === 'connected');
	const tiktok = accounts.find((a) => a.network === 'tiktok');
	if (tiktok)
		await run('tiktok creator info', {
			resource: 'account',
			operation: 'getTiktokCreatorInfo',
			accountId: tiktok.id,
		});

	const binary = {
		data: { data: png().toString('base64'), mimeType: 'image/png', fileName: 'rizamo-n8n.png' },
	};

	// An upload n8n tries again in the same execution: the same media comes back, ready, and the file is not sent twice.
	const [media] = await run(
		'upload an image',
		{
			resource: 'media',
			operation: 'upload',
			binaryPropertyName: 'data',
			additionalFields: { alt: 'A violet square' },
		},
		[{ json: {}, binary }],
	);
	assert.equal(media.status, 'ready', `the upload ended ${media.status}`);
	const [mediaAgain] = await run(
		'upload it again in the same execution',
		{
			resource: 'media',
			operation: 'upload',
			binaryPropertyName: 'data',
			additionalFields: { alt: 'A violet square' },
		},
		[{ json: {}, binary }],
	);
	if (process.env.RIZAMO_DEMO !== '1')
		assert.equal(mediaAgain.id, media.id, 'a retried upload made a second file');
	await run('get the media', { resource: 'media', operation: 'get', mediaId: media.id });

	// A short link n8n tries again in the same execution: the same link comes back.
	const link = {
		resource: 'link',
		operation: 'create',
		url: 'https://rizamo.com/',
		additionalFields: { utmSource: 'n8n', utmCampaign: 'node-check' },
	};
	const [made] = await run('create a short link', link);
	const [madeAgain] = await run('create it again in the same execution', link);
	if (process.env.RIZAMO_DEMO !== '1')
		assert.equal(madeAgain.id, made.id, 'a retry made a second link');
	await run('get the link', { resource: 'link', operation: 'get', linkId: made.id });
	for (const id of new Set([made.id, madeAgain.id])) {
		await httpRequest({
			method: 'DELETE',
			url: `${BASE}/links/${id}`,
			headers: { Authorization: `Bearer ${KEY}` },
		});
	}

	if (!account) {
		console.log('--  posts skipped: the key reaches no connected account');
	} else {
		const params = {
			resource: 'post',
			operation: 'create',
			profileId: account.profileId,
			accountIds: [account.id],
			text: `n8n node check ${new Date().toISOString()}`,
			when: 'draft',
			mediaSource: 'binary',
			binaryPropertyName: 'data',
			additionalFields: { alt: 'A violet square' },
		};
		const [post] = await run('create draft with an uploaded image', params, [{ json: {}, binary }]);
		assert.equal(post.status, 'draft');
		assert.equal(post.media.length, 1);

		// n8n trying the node again in the same execution: the same post comes back, not a second one.
		const [again] = await run('create again in the same execution', params, [{ json: {}, binary }]);
		// The web app's local demo takes no idempotency keys: RIZAMO_DEMO=1 skips this check there.
		if (process.env.RIZAMO_DEMO === '1') {
			await run('delete the demo duplicate', {
				resource: 'post',
				operation: 'delete',
				postId: again.id,
			});
		} else {
			assert.equal(again.id, post.id, 'a retry made a second post');
		}

		executionId = `${executionId}-2`;
		const [other] = await run('create in another execution', { ...params, mediaSource: 'none' });
		assert.notEqual(other.id, post.id);

		const [got] = await run('get', { resource: 'post', operation: 'get', postId: post.id });
		assert.equal(got.id, post.id);
		await run('get many', {
			resource: 'post',
			operation: 'getAll',
			returnAll: false,
			limit: 5,
			filters: { status: 'draft' },
		});
		await run('delete', { resource: 'post', operation: 'delete', postId: post.id });
		await run('delete the other', { resource: 'post', operation: 'delete', postId: other.id });
	}

	await assert.rejects(
		run('get a missing post', { resource: 'post', operation: 'get', postId: 'post_missing' }),
		(e) => {
			assert.match(e.message, /not found/i, `Rizamo's message should be the error: ${e.message}`);
			return true;
		},
	);

	await run('overview', {
		resource: 'analytics',
		operation: 'getOverview',
		period: 'days',
		days: 7,
		options: {},
	});
	await run('post performance', {
		resource: 'analytics',
		operation: 'getPostPerformance',
		period: 'days',
		days: 30,
		returnAll: false,
		limit: 5,
		options: {},
	});
	const threads = await run('open threads', {
		resource: 'thread',
		operation: 'getAll',
		status: 'open',
		returnAll: false,
		limit: 3,
		filters: {},
	});
	if (threads.length)
		await run('a thread', {
			resource: 'thread',
			operation: 'get',
			threadId: threads[0].id,
			messagesLimit: 5,
		});

	const secret = `whsec_${crypto.randomBytes(32).toString('base64')}`;
	const body = '{"id":"ev_1","type":"post.published"}';
	const ts = Math.floor(Date.now() / 1000);
	const sig = `v1,${crypto
		.createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
		.update(`ev_1.${ts}.${body}`)
		.digest('base64')}`;
	const headers = {
		'webhook-id': 'ev_1',
		'webhook-timestamp': String(ts),
		'webhook-signature': sig,
	};
	assert.ok(verifySignature(secret, headers, body));
	assert.ok(!verifySignature(secret, headers, `${body} `));
	console.log('ok  trigger signature');
	console.log('All checks passed.');
})().catch((e) => {
	console.error(`FAILED: ${e.message}${e.description ? ` (${e.description})` : ''}`);
	process.exit(1);
});
