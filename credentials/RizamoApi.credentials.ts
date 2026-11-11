import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RizamoApi implements ICredentialType {
	name = 'rizamoApi';

	displayName = 'Rizamo API';

	icon: Icon = { light: 'file:../nodes/Rizamo/rizamo.svg', dark: 'file:../nodes/Rizamo/rizamo.dark.svg' };

	documentationUrl = 'https://docs.rizamo.com/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'rz_live_...',
			description: 'Create one in Rizamo under Developers. It starts with rz_live_.',
		},
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.rizamo.com/v1',
			description: 'Leave as it is, unless Rizamo gave you another address to test with',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/profiles',
			method: 'GET',
		},
	};
}
