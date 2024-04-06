export enum CognitoResponseType {
	Authenticated = "authenticated",
	PasswordReset = "NEW_PASSWORD_REQUIRED",
	NotAuthorized = "NotAuthorizedException",
	ForcePasswordReset = "PasswordResetRequiredException",
	InvalidCode = "CodeMismatchException",
	LimitExceededException = "LimitExceededException",
	OtpChallenge = "OtpChallenge",
	MagicLink = "MagicLink",
	Success = "SUCCESS"
}

export enum CognitoRequestType {
	Authentication = "authentication",
	NewUserPasswordReset = "new-user-password-reset",
	ForcePasswordReset = "force-password-reset",
	ForgotPassword = "forgot-password",
	UpdatePasswordWithCode = "update-password-with-code",
	PasswordReset = "password-reset",
	ConfirmPassword = "confirm-password",
	OtpChallenge = "otp-challenge",
	MagicLink = "magic-link"
}

export enum CognitoFormType {
	Login = "login",
	NewUser = "new-user",
	ForcePasswordReset = "force-password-reset",
	UserPasswordReset = "user-password-reset",
	UserVerificationRequest = "user-verification-request",
	PasswordUpdateSuccessful = "password-update-successful",
	GoogleSignIn = "google-sign-in"
}