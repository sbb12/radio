import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '$env/static/private';

let pb: PocketBase | null = null;
let authPromise: Promise<void> | null = null;

export async function getPocketBase(): Promise<PocketBase> {	
	const pb = new PocketBase(POCKETBASE_URL);
	return pb
}



export async function validatePocketbase(token: string | undefined) {
	if (!token) {
		return {
			pb: null,
			valid: false,
		}
	}
	const pb = new PocketBase(POCKETBASE_URL)
	pb.authStore.save(token)
	try {
		const record = await pb.collection('users').authRefresh()
		return {
			pb,
			valid: pb.authStore.isValid && pb.authStore.record?.verified
		}
	} catch (e) {
		return {
			pb,
			valid: false,
			e: e
		}
	}


}