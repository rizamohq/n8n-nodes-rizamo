import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['analytics'], operation } });

export const analyticsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['analytics'] } },
		options: [
			{
				name: 'Get Overview',
				value: 'getOverview',
				description: 'Views, reach, engagements and followers for a period against the one before, and the top posts',
				action: 'Get an analytics overview',
			},
			{
				name: 'Get Post Performance',
				value: 'getPostPerformance',
				description: 'Every post of a period, ranked',
				action: 'Get post performance',
			},
		],
		default: 'getOverview',
	},
];

export const analyticsFields: INodeProperties[] = [
	{
		displayName: 'Period',
		name: 'period',
		type: 'options',
		options: [
			{ name: 'Last Days', value: 'days', description: 'The last complete days, up to yesterday' },
			{ name: 'Date Range', value: 'range' },
		],
		default: 'days',
		displayOptions: show(['getOverview', 'getPostPerformance']),
	},
	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 365 },
		default: 30,
		displayOptions: { show: { resource: ['analytics'], period: ['days'] } },
	},
	{
		displayName: 'From',
		name: 'from',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['analytics'], period: ['range'] } },
		description: 'The first day',
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'dateTime',
		default: '',
		displayOptions: { show: { resource: ['analytics'], period: ['range'] } },
		description: 'The last day. Left out, yesterday. Up to 365 days in all.',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: show(['getPostPerformance']),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: ['analytics'], operation: ['getPostPerformance'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['getOverview', 'getPostPerformance']),
		options: [
			{
				displayName: 'Attribution',
				name: 'attribution',
				type: 'options',
				displayOptions: { show: { '/operation': ['getOverview'] } },
				options: [
					{
						name: 'Received',
						value: 'received',
						description: 'What arrived in the period, on posts of any age',
					},
					{
						name: 'Publish',
						value: 'publish',
						description: 'The posts published in the period, with everything they got',
					},
				],
				default: 'received',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				displayOptions: { show: { '/operation': ['getPostPerformance'] } },
				options: [
					{ name: 'Highest First', value: 'desc' },
					{ name: 'Lowest First', value: 'asc' },
				],
				default: 'desc',
			},
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'Only this profile. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Sort By',
				name: 'sort',
				type: 'options',
				displayOptions: { show: { '/operation': ['getPostPerformance'] } },
				options: [
					{ name: 'Engagement Rate', value: 'engagementRate' },
					{ name: 'Engagements', value: 'engagements' },
					{ name: 'Published At', value: 'publishedAt' },
					{ name: 'Reach', value: 'reach' },
					{ name: 'Views', value: 'views' },
				],
				default: 'views',
			},
			{
				displayName: 'Time Zone',
				name: 'timeZone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Lisbon',
				description: "The time zone the days are in. Left out, the profile's.",
			},
		],
	},
];
