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