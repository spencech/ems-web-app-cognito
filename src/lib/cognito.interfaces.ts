import { CognitoResponseType, CognitoRequestType } from "./cognito.types";
import { CognitoUserSession, CognitoUser }  from 'amazon-cognito-identity-js';

export interface ICognitoResponse {
	request: CognitoRequestType,
	type: CognitoResponseType,
	user: CognitoUser,
	session: CognitoUserSession | null,
	userAttributes?: Record<string, string>,
	requiredAttributes?: string[]
	error?: any
}