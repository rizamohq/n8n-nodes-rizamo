import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['media'], operation } });

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['media'] } },
		options: [
			{ name: 'Get', value: 'get', description: 'Get a file and whether it is ready', action: 'Get media' },
			{
				name: 'Import From URL',
				value: 'importUrl',
				description: 'Rizamo downloads a file from a public address',
				action: 'Import media from a URL',
			},
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload a binary file from an earlier node',
				action: 'Upload media',
			},
		],
		default: 'upload',
	},
];

export const mediaFields: INodeProperties[] = [
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: show(['upload']),
		description: 'The binary field with the file: JPEG, PNG, WebP, MP4 or MOV, up to 4 GB',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/photo.jpg',
		displayOptions: show(['importUrl']),
		description: 'A public http or https address of the file',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['upload', 'importUrl']),
		options: [
			{
				displayName: 'Alt Text',
				name: 'alt',
				type: 'string',
				default: '',
				description: 'Describes the image for people who cannot see it',
			},
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'The profile the file joins at once. Left out, it joins the first post that uses it. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
	{
		displayName: 'Media ID',
		name: 'mediaId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'med_...',
		displayOptions: show(['get']),
	},
];
