import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpRequest, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map, tap, take } from "rxjs/operators";
import 'cross-fetch/polyfill';
import { CognitoUser, CognitoUserPool, CognitoUserSession, AuthenticationDetails }  from 'amazon-cognito-identity-js';
import { ICognitoResponse } from "./cognito.interfaces";
import { CognitoResponseType, CognitoRequestType, CognitoFormType } from "./cognito.types";

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

  constructor() {

  }

  public initialize(UserPoolId: string, ClientId: string) {
    this.pool = new CognitoUserPool({ UserPoolId, ClientId });
    this.user = this.pool.getCurrentUser();
    this.userSource.next(this.user);
    this.user?.getSession((e: Error, session: null) => this.sessionSource.next(session));
  }

  public showForm(form: CognitoFormType | null) {
    this.formSource.next(form);
  }

  public logout() {
    return new Promise((resolve: (result: any) => void, reject: (result: any) => void) => {
      if(this.user) {
        this.userSource.next(null);
        this.sessionSource.next(null);
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
    const data = { Username, Pool: this.pool };
    const user = new CognitoUser(data);
    return new Promise((resolve: (result: any) => void, reject: (result: any) => void) => {
        if(!this.user) this.authenticateUser(user, details, resolve, reject);
        else this.getUserSession(resolve, reject)
    });
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
    const data = { Username, Pool: this.pool };
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
         onSuccess: (response: any) => { console.log(response);  resolve({ type: CognitoResponseType.Success, user, request, session: null }) },
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
}
