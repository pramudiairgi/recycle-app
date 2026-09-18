export class Container {
	private services = new Map<string, unknown>();
	private factories = new Map<string, () => Promise<unknown>>();

	register(name: string, factory: () => Promise<unknown>): void {
		this.factories.set(name, factory);
	}

	async resolve<T>(name: string): Promise<T> {
		if (this.services.has(name)) {
			return this.services.get(name) as T;
		}
		const factory = this.factories.get(name);
		if (!factory) {
			throw new Error(`Service "${name}" not registered in container`);
		}
		const instance = await factory();
		this.services.set(name, instance);
		return instance as T;
	}

	has(name: string): boolean {
		return this.services.has(name) || this.factories.has(name);
	}
}
