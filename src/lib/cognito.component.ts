import { Component, OnInit, HostBinding, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import { CognitoService } from "./cognito.service";
import { CognitoUser, CognitoUserSession, CognitoIdToken, CognitoAccessToken }  from 'amazon-cognito-identity-js';
import { ICognitoResponse, ICognitoUserData } from "./cognito.interfaces";
import { CognitoStrings } from "./cognito.classes";
import { CognitoResponseType, CognitoRequestType, CognitoFormType } from "./cognito.types";
import { unsnake, tick, params, trim } from "./cognito.utils";
import { HttpErrorResponse } from '@angular/common/http';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

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
  @Input("provider-name") providerName: string = "Google";
  @Input("client-id") clientId!: string;
  @Input("cognito-signin-url") cognitoUrl?: string;
  @Input("region") region!: string;
  @Input("modal-background") modalBackground: string = "rgba(255,255,255,0.5)";
  @Input("z-index") zIndex: number = 1000;
  @Input("hook") hook?: (state: any) => Promise<boolean>;
  @Input("srp") srp: boolean = true;
  @Input("otp") otp: boolean = false;
  @Input("magic-link") magicLink: boolean = false;
  @Input("magic-link-generator") magicLinkGenerator?: Promise<boolean>;
  @Input("reload-after-link-authentication") reloadAfterLinkAuthentication: boolean = true;
  @Input("passkeys") passkeys: boolean = false;

  @Input("passkeys-get-user-id") getUserId!: (username: string) => Promise<string>;
  @Input("passkeys-generate-authentication-options") generateAuthenticationOptions!: (email: string) => Promise<any>;
  @Input("passkeys-generate-registration-options") generateRegistrationOptions!: (token: string) => Promise<any>;
  @Input("passkeys-verify-registration") verifyRegistration!: (input: any, token: string ) => Promise<any>;
  @Input("passkeys-verify-authentication") verifyAuthentication!: (input: any) => Promise<any>;

  @Output("ready") onReady: EventEmitter<any> = new EventEmitter();
  @Output("connecting") onConnecting: EventEmitter<boolean> = new EventEmitter();
  @Output("authenticated") onAuthenticated: EventEmitter<ICognitoUserData | null> = new EventEmitter();
  @Output("response") onResponse: EventEmitter<any> = new EventEmitter(); 
  @Output("usernameEntered") onUsernameEntered: EventEmitter<string> = new EventEmitter();

  public model: any = { username: null, password: null};
  public componentStyle: Record<string, string | number> = {};
  public formType: CognitoFormType | null = null;
  public CognitoFormType = CognitoFormType;
  public rows: any[] = [];
  public error: string | null = null;
  public prompt: string | null = null;
  public cache: ICognitoResponse | null = null;
  public strings = CognitoStrings;
  public showPasswordField: boolean = true;
  public showEmailSubmitButton: boolean = true;

  private session: CognitoUserSession | null = null;
  private user: CognitoUser | null = null;
  public passkeyAuthOptions?: any;
  public passkeyRegOptions?: any;

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

    if(this.otp || this.magicLink) {
      this.showPasswordField = false;
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initialize());
  }

  onEnterUsername() {
    this.showEmailSubmitButton = false;
    this.onUsernameEntered.emit(this.model.username!.replace(/\s+/gim,""));
  }

  async login() {

    if(!this.srp && this.otp) {
      return this.getOtp();
    } else if(!this.srp && this.magicLink) {
      return this.getMagicLink();
    } else if(!this.srp && this.passkey) {
      return this.getPasskey();
    } else if(!this.srp) {
      return this.onEnterUsername();
    }

    let response: ICognitoResponse;
    this.error = null;
    this.model.password = trim(this.model.password);

    if(this.hook) {
      const proceed = await this.hook({ "state": "before-login", model: this.model });
      if(!proceed) return;
    }

    try {
      const username = this.model.username!.replace(/\s+/gim,"");
      this.onConnecting.emit(true);
      response = await this.cognito.authenticate(username, this.model.password!);
    } catch(e: any) {
      response = e;
    } finally {
      this.handleResponse(response!);
    }
  }

  async getOtp() {
    let response: ICognitoResponse;
    this.error = null;

    try {
      this.onConnecting.emit(true);

      const username = this.model.username!.replace(/\s+/gim,"");
      const otp = this.model.otp ? trim(this.model.otp) : undefined;

      this.srp = false;
      this.magicLink = false;
      this.passkeys = false;

      if(this.hook) {
        const proceed = await this.hook({ "state": "before-otp-request", model: this.model });
        if(!proceed) return this.connectionComplete();
      }
      
      response  = await this.cognito.otpAuthenticate(username, otp);

      if(this.hook) {
        //@ts-ignore
        const proceed = await this.hook({ "state": "after-otp-request", model: this.model, sessionId: response.user.Session });
        if(!proceed) throw new Error("Unable to proceed");
      }
    } catch(e: any) {
      response = e;
    } finally {
      this.handleResponse(response!);
    }
  }

  async getMagicLink() {
    
    let response: ICognitoResponse;
    this.error = null;

    try {
      const username = this.model.username!.replace(/\s+/gim,"");
      this.onConnecting.emit(true);

      if(this.hook) {
        const proceed = await this.hook({ "state": "before-magic-link-request", model: this.model });
        if(!proceed) return this.connectionComplete();
      }

      response = await this.cognito.magicLinkAuthenticate(username);
      
      if(this.hook) {
        //@ts-ignore
        const proceed = await this.hook({ "state": "after-magic-link-request", model: this.model, sessionId: response.user.Session });
        if(!proceed) return this.connectionComplete();
      }
    } catch(e: any) {
      response = e;
    } finally {
      this.connectionComplete();
    }
  }

  async processMagicLink(email: string, code: string, sessionId: string) {
    try {
      this.onConnecting.emit(true);
      await this.cognito.magicLinkAuthenticate(email, code, sessionId);
      if(this.reloadAfterLinkAuthentication) {
        window.location.href = window.location.origin;
      } else {
        this.onAuthenticated.emit(this.getUserData()); //connected
        this.showForm = false;
        this.connectionComplete();
      }
    } catch(e: any) { } 
  }

  async getPasskey() {
    const username = this.model.username!.replace(/\s+/gim,"");
    this.passkeyAuthOptions = await this.generateAuthenticationOptions(username);
    
    const credentials = this.passkeyAuthOptions?.allowCredentials ?? [];
    if(!credentials.length && !this.model.passkey) this.sendPasskeyCode();
    else if(!credentials.length) this.registerPasskey();
    else this.usePasskey();
  }

  private async sendPasskeyCode() {
    const username = this.model.username!.replace(/\s+/gim,"");
    const token = await this.getUserId(username);
    this.srp = false;
    this.otp = false;
    this.magicLink = false;
    this.model.showChallengeEntry = true;
  }

  private async usePasskey() {
    const username = this.model.username!.replace(/\s+/gim,"");
    this.onConnecting.emit(true);
    const authentication = await startAuthentication(this.passkeyAuthOptions);
    const outcome = await this.verifyAuthentication(authentication);
    await this.cognito.passkeyAuthenticate(username);
    
    if(outcome.verified) {
      await this.cognito.passkeyAuthenticate(username, outcome.uid);
      this.onAuthenticated.emit(this.getUserData());
      this.showForm = false;
      this.connectionComplete();
    }
  }

  private async registerPasskey() {
    const username = this.model.username!.replace(/\s+/gim,"");
    const code = this.model.passkey!.replace(/\s+/gim,"");

    this.onConnecting.emit(true);
    const options = await this.generateRegistrationOptions(code);
    const registration = await startRegistration(options);
    const outcome = await this.verifyRegistration(registration, code);
    await this.cognito.passkeyAuthenticate(username);
    
    if(outcome.verified) {
      await this.cognito.passkeyAuthenticate(username, outcome.uid);
      this.onAuthenticated.emit(this.getUserData());
      this.showForm = false;
      this.connectionComplete();
    }
  }

  async onNewUser() {
    let response: ICognitoResponse;
    this.error = null;
    this.model.newPassword = trim(this.model.newPassword);

    if(this.hook) {
      const proceed = await this.hook({ "state": "before-registration", model: this.model });
      if(!proceed) return;
    }
    
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
    
    this.model.code = trim(this.model.code);
    this.model.newPassword = trim(this.model.newPassword);
    this.onConnecting.emit(true);

    if(this.hook) {
      const proceed = await this.hook({ "state": "before-force-password-reset", model: this.model });
      if(!proceed) return;
    }
    
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

    this.model.password = trim(this.model.password);
    this.model.newPassword = trim(this.model.newPassword);

    if(this.hook) {
      const proceed = await this.hook({ "state": "before-user-password-reset", model: this.model });
      if(!proceed) return;
    }
    
    try {
      const response = await this.cognito.resetPassword(this.user!, this.model.password!, this.model.newPassword);
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

    const username = this.model.username!.replace(/\s+/gim,"");
    const model = { username };

    if(this.hook) {
      const proceed = await this.hook({ "state": "request-verification-code", "username": username, model });
      if(!proceed) return;
      this.model.username = model.username;
    }

    this.onConnecting.emit(true);
    this.error = null;
    
    try {
      const response = await this.cognito.requestVerificationCode(model.username);
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
    this.cache = response.userAttributes ? response : this.cache;

    if(response.error?.code === CognitoResponseType.NotAuthorized && response.request === CognitoRequestType.Authentication) {
      this.connectionComplete(); //likely bad password or too many attempts
    } else if(response.error?.code === CognitoResponseType.ForcePasswordReset && response.request === CognitoRequestType.Authentication) {
      this.initiatePasswordReset(response); //admin has forced user password reset
    } else if(response.type === CognitoResponseType.OtpChallenge) {
      this.model.showChallengeEntry = true;
      this.connectionComplete();
    } else if(response.type === CognitoResponseType.PasswordReset && response.request === CognitoRequestType.Authentication) {
      this.prompt = CognitoStrings.onFirstLogin;
      this.showPasswordResetForm(response); //new user
    } else if(!response.error?.code && (response.request === CognitoRequestType.Authentication || response.type === CognitoResponseType.Authenticated )) {
      this.onAuthenticated.emit(this.getUserData()); //connected
      this.showForm = false;
      this.connectionComplete();
    } else {
      this.connectionComplete(); //unsupported response -- hopefully described in messaging
    }

    this.onResponse.emit({ response, model: this.model });
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
    if(!this.cache?.requiredAttributes) return attributes;
    this.cache!.requiredAttributes!.forEach(key => attributes[key] = this.model[key]);
    return attributes;
  }

  private signInWithGoogle() {
    const url = `${this.cognitoUrl}/oauth2/authorize?identity_provider=${this.providerName}&redirect_uri=${window.location.origin}&response_type=TOKEN&client_id=${this.clientId}&scope=email openid profile aws.cognito.signin.user.admin`;
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
