import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{ name: 'Get', value: 'get', description: 'Get a social account', action: 'Get an account' },
			{ name: 'Get Many', value: 'getAll', description: 'Get many social accounts', action: 'Get many accounts' },
			{
				name: 'Get TikTok Creator Info',
				value: 'getTiktokCreatorInfo',
				description: "What a TikTok account allows: privacy levels, comments, Duet and Stitch, the longest video",
				action: 'Get creator info',
			},
		],
		default: 'getAll',
	},
];

export const accountFields: INodeProperties[] = [
	{
		displayName: 'Account Name or ID',
		name: 'accountId',
		type: 'options',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: { loadOptionsMethod: 'getAccounts' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['account'], operation: ['get', 'getTiktokCreatorInfo'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		displayOptions: { show: { resource: ['account'], operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['account'], operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['account'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'Only this profile\'s accounts. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Connected', value: 'connected' },
					{ name: 'Disconnected', value: 'disconnected' },
					{ name: 'Expiring', value: 'expiring' },
				],
				default: 'connected',
			},
		],
	},
];

export const profileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['profile'] } },
		options: [
			{ name: 'Get', value: 'get', description: 'Get a profile', action: 'Get a profile' },
			{ name: 'Get Many', value: 'getAll', description: 'Get every profile you reach', action: 'Get many profiles' },
		],
		default: 'getAll',
	},
];

export const profileFields: INodeProperties[] = [
	{
		displayName: 'Profile Name or ID',
		name: 'profileId',
		type: 'options',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: { loadOptionsMethod: 'getProfiles' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['profile'], operation: ['get'] } },
	},
];
