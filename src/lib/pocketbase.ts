import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '$env/static/private';

let pb: PocketBase | null = null;
let authPromise: Promise<void> | null = null;

export async function getPocketBase(): Promise<PocketBase> {
	if (!pb) {
		if (!POCKETBASE_URL) {
			throw new Error('POCKETBASE_URL environment variable is not set');
		}

		pb = new PocketBase(POCKETBASE_URL);		
		
	} else if (authPromise) {
		// Wait for any ongoing authentication
		await authPromise;
	}

	return pb;
}

