import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpRequest, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map, tap, take } from "rxjs/operators";
import 'cross-fetch/polyfill';
import { CognitoUser, CognitoUserPool, CognitoUserSession, CognitoIdToken, CognitoAccessToken, CognitoRefreshToken, AuthenticationDetails }  from 'amazon-cognito-identity-js';
import { ICognitoResponse, ICognitoUserData } from "./cognito.interfaces";
import { CognitoResponseType, CognitoRequestType, CognitoFormType } from "./cognito.types";
import { EphemeralStorage } from "./cognito.classes";
import { params } from "./cognito.utils";
import { jwtDecode } from "jwt-decode";

@Injectable({
  providedIn: 'root'
})
export class CognitoService {

  private sessionSource: BehaviorSubject<CognitoUserSession | null> = new BehaviorSubject<CognitoUserSession | null>(null);
  public session$: Observable<CognitoUserSession | null> = this.sessionSource.asObservable();

  private userSource: BehaviorSubject<CognitoUser | null> = new BehaviorSubject<CognitoUser | null>(null);
  public user$: Observable<CognitoUser | null> = this.userSource.asObservable();

  private formSource: BehaviorSubject<CognitoFormType | null> = new BehaviorSubject<CognitoFormType | null>(null);
  public form$: Observable<CognitoFormType | null> = this.formSource.asObservable();


  private user: CognitoUser | null = null;
  private pool!: CognitoUserPool;

  private accessToken?: string;
  private idToken?: string;
  private storage: EphemeralStorage = new EphemeralStorage();
  private useLocalStorage: boolean = true;

  constructor(private http: HttpClient) {

  }

  public initialize(UserPoolId: string, ClientId: string, useLocalStorage: boolean = true, idToken?: string, accessToken?: string, refreshToken?: string ) {

    //for federated users
    const access = params("access_token") ?? accessToken ?? localStorage.getItem("ems_access_token") ?? null;
    const id = params("id_token") ?? idToken ?? localStorage.getItem("ems_id_token") ?? null;
    const sessionId = params("sessionId") ?? null;
    const otp = params("otp") ?? null;

    this.useLocalStorage = useLocalStorage;

    if(useLocalStorage && access && id) {
      localStorage.setItem("ems_access_token", access);
      localStorage.setItem("ems_id_token", id);
      window.location.hash = "";
    } 

    this.accessToken = access;
    this.idToken = id;

    //for srp users
    if(useLocalStorage) {
      this.pool = new CognitoUserPool({ UserPoolId, ClientId });
      this.user = this.pool.getCurrentUser();
      this.userSource.next(this.user);
      this.user?.getSession((e: Error, session: null) => this.sessionSource.next(session));
    } else {
      this.setCognitoUserFromToken(UserPoolId, ClientId, idToken, accessToken, refreshToken);
    }
    
  }

  public setCognitoUserFromToken (UserPoolId: string, ClientId: string, idToken?: string, accessToken?: string, refreshToken?: string) {
      this.pool = new CognitoUserPool({ UserPoolId, ClientId, Storage: this.storage });
      
      if(idToken) {
        const decoded: any = jwtDecode(idToken);
        this.user = new CognitoUser({
            Username: decoded['cognito:username'],
            Pool: this.pool, 
            Storage: this.storage
        });

        const idTokenObj = new CognitoIdToken({ IdToken: idToken });
        const accessTokenObj = new CognitoAccessToken({ AccessToken: accessToken! });
        const refreshTokenObj = new CognitoRefreshToken({ RefreshToken: refreshToken! });
        const session = new CognitoUserSession({ IdToken: idTokenObj, AccessToken: accessTokenObj, RefreshToken: refreshTokenObj });

        // Set the session to the Cognito user
        this.user.setSignInUserSession(session);
        
      } else {
        this.user = this.pool.getCurrentUser();
      }
      
      this.userSource.next(this.user);
      this.user?.getSession((e: Error, session: null) => this.sessionSource.next(session));
      return this.user;
  };

  public magicLinkAuthenticate(Username: string, ChallengeResponse?: string, SessionId?: string) {
    const request = ChallengeResponse ? CognitoRequestType.MagicLink : CognitoRequestType.Authentication;
    const details = new AuthenticationDetails({ Username });
    const data: any = { Username, Pool: this.pool };
    if(!this.useLocalStorage) data.Storage = this.storage;
    const user = this.user = this.user ?? new CognitoUser(data);
    this.user.setAuthenticationFlowType('CUSTOM_AUTH');

    //@ts-ignore
    if(SessionId) this.user.Session = SessionId;

    return new Promise(async( resolve: (result: any) =>void, reject: (result: any) => void) => {
      const handler = {
        onSuccess: (session: CognitoUserSession) => {
          this.sessionSource.next(session);
          this.userSource.next(this.user);
          resolve({ type: CognitoResponseType.Authenticated, session, user, request })
        },
        onFailure: (error: any)=> reject({ type: CognitoResponseType.NotAuthorized, error, user, request, session: null }),
        customChallenge: (challengeParameters: any) => {
          resolve({ type: CognitoResponseType.MagicLink, user, request, challengeParameters });
        }
      };
      
      if(ChallengeResponse) user.sendCustomChallengeAnswer(ChallengeResponse, handler);
      else user.initiateAuth(details, handler);
    });
  }

  public passkeyAuthenticate(Username: string, ChallengeResponse?: string) {
    const request = ChallengeResponse ? CognitoRequestType.Passkey : CognitoRequestType.Authentication;
    const details = new AuthenticationDetails({ Username });
    const data:any = { Username, Pool: this.pool };
    if(!this.useLocalStorage) data.Storage = this.storage;
    const user = this.user = this.user ?? new CognitoUser(data);
    this.user.setAuthenticationFlowType('CUSTOM_AUTH');

    return new Promise(async( resolve: (result: any) =>void, reject: (result: any) => void) => {
      const handler = {
        onSuccess: (session: CognitoUserSession) => {
          this.sessionSource.next(session);
          this.userSource.next(this.user);
          resolve({ type: CognitoResponseType.Authenticated, session, user, request })
        },
        onFailure: (error: any)=> reject({ type: CognitoResponseType.NotAuthorized, error, user, request, session: null }),
        customChallenge: (challengeParameters: any) => resolve({ type: CognitoResponseType.Passkey, user, request, challengeParameters })
      };
      
      if(ChallengeResponse) user.sendCustomChallengeAnswer(ChallengeResponse, handler);
      else user.initiateAuth(details, handler);
    });
  }

  public otpAuthenticate(Username: string, ChallengeResponse?: string) {
    const request = ChallengeResponse ? CognitoRequestType.OtpChallenge : CognitoRequestType.Authentication;
    const details = new AuthenticationDetails({ Username });
    const data:any = { Username, Pool: this.pool };
    if(!this.useLocalStorage) data.Storage = this.storage;
    const user = this.user = this.user ?? new CognitoUser(data);
    this.user.setAuthenticationFlowType('CUSTOM_AUTH');

    return new Promise(async( resolve: (result: any) =>void, reject: (result: any) => void) => {
      const handler = {
        onSuccess: (session: CognitoUserSession) => {
          this.sessionSource.next(session);
          this.userSource.next(this.user);
          resolve({ type: CognitoResponseType.Authenticated, session, user, request })
        },
        onFailure: (error: any)=> reject({ type: CognitoResponseType.NotAuthorized, error, user, request, session: null }),
        customChallenge: (challengeParameters: any) => resolve({ type: CognitoResponseType.OtpChallenge, user, request, challengeParameters })
      };
      
      if(ChallengeResponse) user.sendCustomChallengeAnswer(ChallengeResponse, handler);
      else user.initiateAuth(details, handler);
    });
  }

  public getUserInfo(url: string): Promise<ICognitoUserData | HttpErrorResponse | undefined> {
    const request = `${url}/oauth2/userInfo`
    const headers = this.headers();

    return this.http.get(request, { headers, withCredentials: true } ).pipe(
        map((result: any) => 
          { return {
            email: result.email,
            username: result.username,
            sub: result.sub,
            firstName: result.given_name,
            lastName: result.family_name,
            accessToken: this.accessToken!,
            idToken: this.idToken!
          }}
        )
     ).toPromise();

    //, catchError(this.handleErrorQuietly)
  }

  public setUserSession(session: CognitoUserSession) {
    this.sessionSource.next(session);
  }

  public showForm(form: CognitoFormType | null) {
    this.formSource.next(form);
  }

  public logout() {
    return new Promise((resolve: (result: any) => void, reject: (result: any) => void) => {
      if(this.user) {
        this.userSource.next(null);
        this.sessionSource.next(null);
        localStorage.removeItem("ems_id_token");
        localStorage.removeItem("ems_access_token");
        this.user.globalSignOut({
          onSuccess: resolve,
          onFailure: () => {
            //if user is disabled, must manually clear local storage (apparently)
            for(let prop in localStorage) {
              if(prop.match(/cognito/i)) localStorage.removeItem(prop);
            }
            resolve(null);
          }
        });
      } else {
        resolve(null);
      }
    });
    
  }

  public authenticate(Username: string, Password: string): Promise<ICognitoResponse> {
    const details = new AuthenticationDetails({ Username, Password});
    const data:any = { Username, Pool: this.pool };
    if(!this.useLocalStorage) data.Storage = this.storage;
    const user = new CognitoUser(data);
    return new Promise((resolve: (result: any) => void, reject: (result: any) => void) => {
        if(!this.user) this.authenticateUser(user, details, resolve, reject);
        else this.getUserSession(resolve, reject)
    });
  }

  public createFederatedSession(IdToken: string, AccessToken: string) {

    const session = new CognitoUserSession({
          IdToken: new CognitoIdToken({ IdToken }),
          AccessToken: new CognitoAccessToken({ AccessToken }),
    });

    const Username = session.getIdToken().payload["cognito:username"];
    const data:any = { Username, Pool: this.pool };
    if(!this.useLocalStorage) data.Storage = this.storage;
    this.user = new CognitoUser(data);
    this.userSource.next(this.user);
    this.sessionSource.next(session);
  }

  public completePasswordUpdate(password: string, user: CognitoUser, attributes: any): Promise<ICognitoResponse> {
    const request = CognitoRequestType.NewUserPasswordReset;
    return new Promise((resolve: (result: ICognitoResponse) => void, reject: (result: ICognitoResponse) => void) => {
      user.completeNewPasswordChallenge(password, attributes, {
        onSuccess: (session: CognitoUserSession) => {
          this.user = user;
          this.userSource.next(user);
          this.sessionSource.next(session);
          resolve({ type: CognitoResponseType.Authenticated, session, user, request: CognitoRequestType.Authentication });
        },
        onFailure: (error: any) => reject({ type: CognitoResponseType.NotAuthorized, error, user, request, session: null })
      })
    });
  }

  public requestVerificationCode(Username: string): Promise<ICognitoResponse> {
    const data: any = { Username, Pool: this.pool };
    if(!this.useLocalStorage) data.Storage = this.storage;
    const user = new CognitoUser(data);
    return this.forgotPassword(user);
  }

  public resetPassword(user: CognitoUser, oldPassword: string, newPassword: string): Promise<ICognitoResponse> {
    const request = CognitoRequestType.PasswordReset;
    return new Promise((resolve: (result: ICognitoResponse) => void, reject: (result: ICognitoResponse) => void) => {
       user.changePassword(oldPassword, newPassword, (error, result) => {
         if(error) reject({ type: CognitoResponseType.LimitExceededException, user, request, error, session: null});
         else resolve({ type: CognitoResponseType.Success, user, request, session: null });
       })
    });
  }

  public forgotPassword(user: CognitoUser): Promise<ICognitoResponse> {
    const request = CognitoRequestType.ForgotPassword;
    return new Promise((resolve: (result: ICognitoResponse) => void, reject: (result: ICognitoResponse) => void) => {
       user.forgotPassword({
         onSuccess: (response: any) => resolve({ type: CognitoResponseType.Success, user, request, session: null }),
         onFailure: (error: any) => reject({ type: CognitoResponseType.LimitExceededException, error, user, request, session: null })
       })
    });
  }

  public confirmPassword(user: CognitoUser, code: string, password: string): Promise<ICognitoResponse> {
    const request = CognitoRequestType.ConfirmPassword;
    return new Promise((resolve: (result: ICognitoResponse) => void, reject: (result: ICognitoResponse) => void) => {
       user.confirmPassword(code, password, {
         onSuccess: (response: any) => { resolve({ type: CognitoResponseType.Success, user, request, session: null }) },
         onFailure: (error: any) => reject({ type: CognitoResponseType.InvalidCode, error, user, request, session: null })
       })
    });
  }

  private authenticateUser(user: CognitoUser, details: AuthenticationDetails, resolve: (result: ICognitoResponse) => void, reject: (result: ICognitoResponse) => void ) {
    const request = CognitoRequestType.Authentication;
    user.authenticateUser(details, {
        onSuccess: (session: CognitoUserSession) => {
          this.sessionSource.next(session);
          this.userSource.next(user);
          this.user = user;
          resolve({ type: CognitoResponseType.Authenticated, session, user, request });
        },
        onFailure: (error: any) => reject({ type: CognitoResponseType.NotAuthorized, error, user, request, session: null }),
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          resolve({type: CognitoResponseType.PasswordReset, userAttributes, requiredAttributes, user, request, session: null })
        }
    });
  }

  private getUserSession(resolve: (result: ICognitoResponse) => void, reject: (result: ICognitoResponse) => void) {
    const request = CognitoRequestType.Authentication;
    this.user!.getSession((error: Error, session: null) => {
      if(error) reject({ type: CognitoResponseType.Authenticated, session, user: this.user!, request, error });
      else {
        this.sessionSource.next(session);
        resolve({ type: CognitoResponseType.Authenticated, session, user: this.user!, request });
      }
    })
  }

  private handleErrorQuietly(error: HttpErrorResponse) {
    return of(error);
  }

  private headers(custom: any = {}) {
    const headers = { 
          "Content-Type": "application/json",
          "Authorization": this.accessToken ? `Bearer ${this.accessToken}` : ""
       };
    return new HttpHeaders(headers);
  }
}
