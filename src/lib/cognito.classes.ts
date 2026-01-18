export class CognitoStrings {
	 public static onUserPasswordChangeSuccessful: string  = "Update successful. Please log in with your new password.";
	 public static onVerificationCodeSent: string = "Enter your email below to generate a verification code.";
	 public static onNewPasswordRequired: string = "You need to create a new password. Please check your email for a verification code and then complete the form below.";
	 public static onFirstLogin: string = "Please complete the fields below to finish account creation.";
	 public static onTooManyAttempts: string = "Too many attempts. Please try again in 15 minutes.";
	 public static onPasswordUpdated: string = "Your password has been updated successfully.";
	 public static labelEmail: string = "Email Address";
	 public static labelPassword: string = "Password";
	 public static labelForgotPassword: string = "Forgot Password";
	 public static labelNewPassword: string = "New Password";
	 public static labelCurrentPassword: string = "Current Password";
	 public static labelConfirmNewPassword: string = "Confirm New Password";
	 public static labelSubmit: string = "Submit";
	 public static labelCode: string = "Code";
	 public static labelClose: string = "Close";
	 public static labelUseRegularPassword: string = "Use Standard Password";
	 public static labelOtp: string = "Email me a One Time Password (OTP)";
	 public static labelOtpEnter: string = "Enter the code that was just emailed to you.";
	 public static labelMagicLink: string = "Email me a magic link";
	 public static labelPasskeys: string = "Use a passkey";
	 public static labelPasskeyEnter: string = "Enter the code that was just emailed to you."
	 public static labelPasswordRequirement: string = "Must be at least 8 characters and contain a number, special character, uppercase and lowercase letter.";
	 public static labelSso: string = "SSO";
	 public static labelOrSignInWith: string = "Or sign in with...";
}


export class EphemeralStorage {
	private _cache: any = {};

	getItem(key: string): any {
		return this._cache[key];
	}

	setItem(key: string, value: any):string {
		this._cache[key] = value;
		return this.getItem(key);
	}

	removeItem(key: string) {
		delete this._cache[key];
	}

	clear() {
		this._cache= {};
	}
}