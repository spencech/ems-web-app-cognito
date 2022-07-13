# EMS Web Application Components: AWS Cognito Username/Password Authentication

**Note:** This module has peer dependencies on AWS packages.

	npm i aws-sdk amazon-cognito-identity-js  ems-web-app-cognito

The Cognito Angular.io module is authored for use within web applications developed by [Educational Media Solutions](https://educationalmediasolutions.com).

Find the [web application template source code on GitHub](https://github.com/spencech/ems-web-app-template) to review implementation in context.

Find a [working example of this component here](https://ems-web-app.educationalmediasolutions.com).

This package includes a component, service and supporting classes that wrap the [Amazon Cognito Identity SDK](https://www.npmjs.com/package/amazon-cognito-identity-js) to enable simple username/password authentication. 

You must set up the User Pool, App Client and Identity Pool in Cognito; this package supports only SRP / email auth flow. This package will be extended as we encounter different auth needs.

Styling is intentionally bare, you will need to customize the CSS to suit your UI requirements.

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.2.0.

## Module Implementation

	import { NgModule } from '@angular/core';
	import { BrowserModule } from '@angular/platform-browser';
	import { CommonModule } from '@angular/common';  

	import { AppComponent } from './app.component';
	import { CognitoModule, CognitoService } from "ems-web-app-cognito";

	@NgModule({
	  declarations: [
	    AppComponent
	  ],
	  imports: [
	    BrowserModule,
	    CommonModule,
	    CognitoModule
	  ],
	  providers: [ CognitoService ],
	  bootstrap: [ AppComponent ]
	})
	export class AppModule { }


## Component Implementation: Template Element

	<cognito pool-id="us-east-1_xxxxxxxx" client-id="xxxxxxxxxxxxxxxxxxx" (connecting)="onConnecting($event)"></cognito>

Supply your user pool and app client id in the attributes above. It is strongly recommended that you use the `connecting` callback to render a loader/status indicator while the component engages with the server.


## Component Implementation: Script

	import { Component, OnInit } from '@angular/core';
	import { LoaderService, LoaderType } from "ems-web-app-loader";
	import { delay } from "ems-web-app-utils";
	import { CognitoService, CognitoFormType, CognitoStrings } from "ems-web-app-cognito";

	@Component({
	  selector: 'app-root',
	  templateUrl: './app.component.html',
	  styleUrls: ['./app.component.less']
	})
	export class AppComponent implements OnInit  {

	  public loading: boolean = false;
	  public loaderSize: number = 200;
	  public authenticated: boolean = false;


	  constructor(private loader: LoaderService, private cognito: CognitoService) {}

	  ngOnInit() {
	  	//indicates whether the user has an active session; undefined if not
	  	//argument is a CognitoUserSession obejct from AWS sdk
	  	//you can use this to get access and id tokens for interaction with other AWS resources
	    this.cognito.session$.subscribe(session => {
	      delay(() => this.authenticated = session ? true : false);
	    });

	    // argument is a CognitoUser obejct from AWS sdk
	    this.cognito.user$.subscribe(user => {
	    	console.log(user);
	    });
	  }
	  

	  onConnecting(connecting: boolean) {
	  	//renders a modal overlay whenever component indicates an active server transaction
	    this.loader.load(connecting);
	  }

	  login() {
	    this.cognito.showForm(CognitoFormType.Login);
	  }

	  changePassword() {
	    this.cognito.showForm(CognitoFormType.UserPasswordReset);
	  }

	  async logout() {
	    await this.cognito.logout();
	    window.location.reload();
	  }
	}

## Component Implementation: Strings

Update the static members of the class below to customize the form language and labels.

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
		 public static labelPasswordRequirement: string = "Must be at least 8 characters and contain a number, special character, uppercase and lowercase letter.";
	}

Example:

	CognitoStrings.labelCode = "Your Verification Code"

## Code scaffolding

Run `ng generate component component-name --project cognito` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module --project cognito`.
> Note: Don't forget to add `--project cognito` or else it will be added to the default project in your `angular.json` file. 

## Build

Run `ng build cognito` to build the project. The build artifacts will be stored in the `dist/` directory.

## Publishing

After building your library with `ng build cognito`, go to the dist folder `cd dist/cognito` and run `npm publish`.

## Running unit tests

Run `ng test cognito` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
