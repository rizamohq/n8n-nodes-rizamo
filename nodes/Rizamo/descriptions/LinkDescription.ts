import type { INodeProperties } from 'n8n-workflow';

export const linkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['link'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Make a short link that counts its clicks',
				action: 'Create a short link',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a short link with its clicks by day and country',
				action: 'Get a short link',
			},
		],
		default: 'create',
	},
];

export const linkFields: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/menu',
		displayOptions: { show: { resource: ['link'], operation: ['create'] } },
		description: 'Where the link sends people',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['link'], operation: ['create'] } },
		options: [
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				description: 'When it stops working. Left out, it never expires.',
			},
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'The profile the link belongs to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'UTM Campaign',
				name: 'utmCampaign',
				type: 'string',
				default: '',
				placeholder: 'autumn-menu',
			},
			{
				displayName: 'UTM Content',
				name: 'utmContent',
				type: 'string',
				default: '',
			},
			{
				displayName: 'UTM Medium',
				name: 'utmMedium',
				type: 'string',
				default: '',
				placeholder: 'social',
			},
			{
				displayName: 'UTM Source',
				name: 'utmSource',
				type: 'string',
				default: '',
				placeholder: 'instagram',
			},
			{
				displayName: 'UTM Term',
				name: 'utmTerm',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Link ID',
		name: 'linkId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'lnk_...',
		displayOptions: { show: { resource: ['link'], operation: ['get'] } },
	},
];
