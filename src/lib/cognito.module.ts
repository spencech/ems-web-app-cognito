import { NgModule } from '@angular/core';
import { CognitoComponent } from './cognito.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LabelerPipe } from "./cognito.pipes";


@NgModule({
  declarations: [
    CognitoComponent,
    LabelerPipe
  ],
  imports: [
    FormsModule,
    CommonModule,
    HttpClientModule
  ],
  exports: [
    CognitoComponent
  ]
})
export class CognitoModule { }
