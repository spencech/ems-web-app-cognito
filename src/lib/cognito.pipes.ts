import { Injectable, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'labeler'
})
@Injectable()
export class LabelerPipe implements PipeTransform {

	transform(label: string): string {
		if(label?.match(/given name/i)) return "First Name";
		if(label?.match(/family name/i)) return "Last Name";
		return label;
	}
}