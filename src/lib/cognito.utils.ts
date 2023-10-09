export function unsnake(input: string = ""): string {
	return input
			.split("_")
			.map(p => p.substring(0,1).toUpperCase() + p.substring(1).toLowerCase())
			.join(" ");
}

export function tick(duration: number = 0) {
	return new Promise((resolve: (value: any) => void) => {
		window.setTimeout(() => resolve(duration), duration);
	});
}

export function trim(input?: string) {
    if(!input) return input;
    return input.replace(/^\s+/, '').replace(/\s+$/, '');
}

export function params(requestedProperty?: string): any {
  const vars = {} as any;
  const parts = window.location.href.replace(/[?&#]+([^=&]+)=([^&]*)/gi, ((m: any, key: string, value: any) => {
    vars[key] = value;
  }) as any);

  for (const prop in vars) {
    if (vars[prop].toLowerCase() === 'true') vars[prop] = true;
    else if (vars[prop].toLowerCase() === 'false') vars[prop] = false;
    else if (!isNaN(parseFloat(vars[prop])) && !vars[prop].match(/[^0-9]+/gim)) vars[prop] = parseFloat(vars[prop]);
  }

  if (requestedProperty) return vars[requestedProperty];
  return vars;
}