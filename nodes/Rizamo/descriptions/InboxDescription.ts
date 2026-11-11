import type { INodeProperties } from 'n8n-workflow';

export const threadOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['thread'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a thread with its messages',
				action: 'Get an inbox thread',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get comment and message threads, open ones first',
				action: 'Get many inbox threads',
			},
			{
				name: 'Mark Done',
				value: 'markDone',
				description: 'Close a thread. A new message opens it again.',
				action: 'Mark an inbox thread done',
			},
			{
				name: 'Reply',
				value: 'reply',
				description: 'Reply as the account, to a comment or a message',
				action: 'Reply to an inbox thread',
			},
		],
		default: 'getAll',
	},
];

export const threadFields: INodeProperties[] = [
	{
		displayName: 'Thread ID',
		name: 'threadId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'thr_...',
		displayOptions: { show: { resource: ['thread'], operation: ['get', 'reply', 'markDone'] } },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['thread'], operation: ['reply'] } },
		description: 'The reply, as the account sends it',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Open', value: 'open', description: 'Still needs an answer' },
			{ name: 'Done', value: 'done', description: 'Answered or closed' },
		],
		default: 'open',
		displayOptions: { show: { resource: ['thread'], operation: ['getAll'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['thread'], operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['thread'], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['thread'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Kind',
				name: 'kind',
				type: 'options',
				options: [
					{ name: 'Comment', value: 'comment' },
					{ name: 'Mention', value: 'mention' },
					{ name: 'Private Message', value: 'dm' },
					{ name: 'Review', value: 'review' },
				],
				default: 'comment',
			},
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'Only this profile\'s threads. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
	{
		displayName: 'Messages Limit',
		name: 'messagesLimit',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		displayOptions: { show: { resource: ['thread'], operation: ['get'] } },
		description: 'How many of the newest messages to return. 0 returns every message.',
	},
];

export const commentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['comment'] } },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a comment on the network. It cannot be undone.',
				action: 'Delete a comment',
			},
			{ name: 'Hide', value: 'hide', description: 'Hide a comment on the network', action: 'Hide a comment' },
			{ name: 'Unhide', value: 'unhide', description: 'Show a hidden comment again', action: 'Unhide a comment' },
		],
		default: 'hide',
	},
];

export const commentFields: INodeProperties[] = [
	{
		displayName: 'Thread ID',
		name: 'threadId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'thr_...',
		displayOptions: { show: { resource: ['comment'] } },
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'msg_...',
		displayOptions: { show: { resource: ['comment'] } },
		description: "The comment's message ID, from Get Inbox Thread",
	},
];
