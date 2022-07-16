import { Component, OnInit, HostBinding, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import { CognitoService } from "./cognito.service";
import { CognitoUser, CognitoUserSession, CognitoIdToken, CognitoAccessToken }  from 'amazon-cognito-identity-js';
import { ICognitoResponse, ICognitoUserData } from "./cognito.interfaces";
import { CognitoStrings } from "./cognito.classes";
import { CognitoResponseType, CognitoRequestType, CognitoFormType } from "./cognito.types";
import { unsnake, tick, params } from "./cognito.utils";
import { HttpErrorResponse } from '@angular/common/http';


@Component({
  selector: 'cognito',
  templateUrl: "./cognito.component.html",
  styleUrls: [ "./cognito.component.less" ]
})
export class CognitoComponent implements OnInit, AfterViewInit {


  @HostBinding("style") hostStyle: Record<string, string | number> = {};
  @HostBinding("class.render") showForm: boolean = false;
  @HostBinding("class.transitioning") transitioning: boolean = false;

  @Input("pool-id") poolId!: string;
  @Input("client-id") clientId!: string;
  @Input("cognito-signin-url") cognitoUrl?: string;
  @Input("region") region!: string;
  @Input("modal-background") modalBackground: string = "rgba(255,255,255,0.5)";
  @Input("z-index") zIndex: number = 1000;

  @Output("ready") onReady: EventEmitter<any> = new EventEmitter();
  @Output("connecting") onConnecting: EventEmitter<boolean> = new EventEmitter();
  @Output("authenticated") onAuthenticated: EventEmitter<ICognitoUserData | null> = new EventEmitter();

  public model: any = { username: null, password: null};
  public componentStyle: Record<string, string | number> = {};
  public formType: CognitoFormType | null = null;
  public CognitoFormType = CognitoFormType;
  public rows: any[] = [];
  public error: string | null = null;
  public prompt: string | null = null;
  public cache: ICognitoResponse | null = null;
  public strings = CognitoStrings;
  
  private session: CognitoUserSession | null = null;
  private user: CognitoUser | null = null;

  constructor(private cognito: CognitoService) {
    
  }

  ngOnInit(): void {
    
    this.cognito.initialize(this.poolId, this.clientId);

    this.cognito.form$.subscribe(form => {
      this.formType = form;
      this.showCurrentForm();
    });
    
    this.cognito.session$.subscribe(session => {
      this.session = session;
    });
    this.cognito.user$.subscribe(user => {
      this.user = user;
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initialize());
  }

  async login() {
    
    let response: ICognitoResponse;
    this.error = null;
    
    try {
      this.onConnecting.emit(true);
      response = await this.cognito.authenticate(this.model.username!, this.model.password!);
    } catch(e: any) {
      response = e;
    } finally {
      this.handleResponse(response!);
    }
  }

  async onNewUser() {
    
    let response: ICognitoResponse;
    this.error = null;
    
    try {
      this.onConnecting.emit(true);
      response = await this.cognito.completePasswordUpdate(this.model.newPassword!, this.cache!.user, this.getUserAttributes());
    } catch(e: any) {
      response = e;
    } finally {
      this.handleResponse(response!);
    }

  }

  async onForcePasswordReset() {
    
    this.onConnecting.emit(true);
    
    try {
      const response = await this.cognito.confirmPassword(this.cache!.user, this.model.code, this.model.newPassword);
      this.error = null;
      this.transitioning = true;
      await tick(250);
      this.formType = CognitoFormType.Login;
      this.setMessaging(response, CognitoStrings.onUserPasswordChangeSuccessful);
      await tick(0);
      this.transitioning = false;
    } catch(e: any) {
      this.setMessaging(e as ICognitoResponse);
    } finally {
      this.onConnecting.emit(false);
    }
  }

  async onUserPasswordReset() {
    
    this.error = null;
    this.onConnecting.emit(true);
    
    try {
      const response = await this.cognito.resetPassword(this.user!, this.model.password, this.model.newPassword);
      this.transitioning = true;
      await tick(250);
      this.formType = CognitoFormType.PasswordUpdateSuccessful;
      this.prompt = CognitoStrings.onPasswordUpdated;
      this.error = null;
      await tick();
      this.transitioning = false;
    } catch(e: any) {
      this.setMessaging(e as ICognitoResponse);
    } finally {
      this.onConnecting.emit(false);
    }

  }

  async onForgotPassword($event: MouseEvent) {
    $event.preventDefault();
    $event.stopImmediatePropagation();
    
    this.transitioning = true;
    await tick(250);
    this.formType = CognitoFormType.UserVerificationRequest;
    this.prompt = CognitoStrings.onVerificationCodeSent;
    this.error = null;
    await tick();
    this.transitioning = false;
  }

  async onRequestVerificationCode() {

    this.onConnecting.emit(true);
    this.error = null;
    
    try {
      const response = await this.cognito.requestVerificationCode(this.model.username);
      this.transitioning = true;
      await tick(250);
      this.setMessaging(response, CognitoStrings.onNewPasswordRequired);
      this.showPasswordResetForm(response, false);
    } catch(e: any) {
      this.setMessaging(e as ICognitoResponse);
    } finally {
      this.connectionComplete();
    }
  }

  newUserFormDisabled() {
    let disabled = false;
    this.cache?.requiredAttributes?.forEach(key => {
      if(!this.model[key]) disabled = true;
    });

    if(!this.model.newPassword || !this.model.newPasswordConfirm) {
      disabled = true;
    }

    if(this.model.newPassword !== this.model.newPasswordConfirm) {
      disabled = true;
    }

    return disabled;
  }

  private async initialize() {


    try {
      if(this.cognitoUrl && localStorage.getItem("ems_access_token")) {
        
        const info = await this.cognito.getUserInfo(this.cognitoUrl) as ICognitoUserData;

        //emulate cognito user/session for federated login
        this.session = new CognitoUserSession({
          IdToken: new CognitoIdToken({ IdToken: info.idToken }),
          AccessToken: new CognitoAccessToken({ AccessToken: info.accessToken }),
        });
        this.cognito.createFederatedSession(info.idToken, info.accessToken)
      }
    } catch (error: any) {
    } finally {
      if(this.session) {
        this.onAuthenticated.emit(this.getUserData());
      }
    }
  }

  private async handleResponse(response: ICognitoResponse) {
    this.transitioning = true;
    
    await tick(250);
    
    this.setMessaging(response);
    this.cache = response;

    if(response.error?.code === CognitoResponseType.NotAuthorized && response.request === CognitoRequestType.Authentication) {
      this.connectionComplete(); //likely bad password or too many attempts
    } else if(response.error?.code === CognitoResponseType.ForcePasswordReset && response.request === CognitoRequestType.Authentication) {
      this.initiatePasswordReset(response); //admin has forced user password reset
    } else if(response.type === CognitoResponseType.PasswordReset && response.request === CognitoRequestType.Authentication) {
      this.prompt = CognitoStrings.onFirstLogin;
      this.showPasswordResetForm(response); //new user
    } else if(!response.error?.code && response.request === CognitoRequestType.Authentication) {
      this.onAuthenticated.emit(this.getUserData()); //connected
      this.showForm = false;
      this.connectionComplete();
    } else {
      this.connectionComplete(); //unsupported response -- hopefully described in messaging
    }
  }

  private async initiatePasswordReset(response: ICognitoResponse) {
    this.error = null;
    try {
      const result = await this.cognito.forgotPassword(response.user);
      this.setMessaging(result, CognitoStrings.onNewPasswordRequired);
      await tick(250);
      this.showPasswordResetForm(response, false);
    } catch(e: any) {
      this.setMessaging(e as ICognitoResponse);
    } finally {
      this.connectionComplete();
    }
  }

  private setMessaging(response: ICognitoResponse, prompt: string | null = null) {
    if(response.error?.code === CognitoResponseType.LimitExceededException) {
      this.error = CognitoStrings.onTooManyAttempts;
    } else {
      this.error = response.error?.message ?? null;
    }

    this.prompt = prompt;
  }

  private async connectionComplete() {
    await tick();
    this.transitioning = false;
    this.onConnecting.emit(false);
  }

  private async showCurrentForm() {
    if(!this.formType) return;

    if(this.formType === CognitoFormType.GoogleSignIn) {
      return this.signInWithGoogle();
    }

    this.hostStyle = {
      "background": this.modalBackground,
      "z-index": this.zIndex
    }

    await tick();

    this.showForm = true;
    this.onReady.emit();
  }

  private async showPasswordResetForm(result: ICognitoResponse, isNewUser: boolean = true) {
    this.cache = result;
    this.rows = [];
    this.formType = isNewUser ? CognitoFormType.NewUser : CognitoFormType.ForcePasswordReset;
    
    //bubble first and last name fields to the top of the attributes list
    result.requiredAttributes?.sort((a,b) => {
      if(a === "given_name" && b === "family_name") return -1;
      if(b === "given_name" && a === "family_name") return 1;
      if(a === "given_name") return -1;
      if(a === "family_name") return - 1;
      if(b === "given_name") return 1;
      if(b === "family_name") return 1;
      return a > b ? 1 : -1;
    });

    //inject formrows for required attributes
    result.requiredAttributes?.forEach(key => {
      if(key.match(/^email/)) return;
      const value = result.userAttributes![key]
      this.rows.push({
        label: unsnake(key),
        key
      });
      this.model[key] = value && value.length ? value : undefined
    });

    await tick();
    this.connectionComplete();
  }

  private getUserAttributes(): Record<string,string> {
    const attributes = {} as Record<string,string>;
    this.cache!.requiredAttributes!.forEach(key => attributes[key] = this.model[key]);
    return attributes;
  }

  private signInWithGoogle() {
    const url = `${this.cognitoUrl}/oauth2/authorize?identity_provider=Google&redirect_uri=${window.location.origin}&response_type=TOKEN&client_id=${this.clientId}&scope=email openid profile aws.cognito.signin.user.admin`;
    window.location.href = url;
  }

  private getUserData(): ICognitoUserData {
    return {
      email: this.session!.getIdToken().payload["email"],
      username: this.session!.getIdToken().payload["cognito:username"],
      sub:  this.session!.getIdToken().payload["sub"],
      firstName: this.session!.getIdToken().payload["given_name"],
      lastName: this.session!.getIdToken().payload["family_name"],
      idToken:  this.session!.getIdToken().getJwtToken(),
      accessToken:  this.session!.getAccessToken().getJwtToken(),
    }
  }

}
