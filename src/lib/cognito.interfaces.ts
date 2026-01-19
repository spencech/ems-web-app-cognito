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

export interface ICognitoUserData {
	accessToken: string,
	idToken: string,
	email: string,
	username: string,
	sub: string,
	firstName: string,
	lastName: string
}

export interface ISSOProvider {
	id: string,
	label: string,
	icon: string,
	hoverText?: string
}