import PocketBase from 'pocketbase';
import { browser } from '$app/environment';

let pb: PocketBase | null = null;
let authPromise: Promise<void> | null = null;

export async function getPocketBase(token?: string): Promise<PocketBase> {
	const pb = new PocketBase("https://pb.sercan.co.uk");
	
	// Restore auth from token parameter, localStorage, or cookie
	if (token) {
		pb.authStore.save(token);
	} else if (browser) {
		// Try to restore from localStorage first
		const storedToken = localStorage.getItem('pb_token');
		if (storedToken) {
			pb.authStore.save(storedToken);
		} else {
			// Fallback to cookie
			const cookies = document.cookie.split(';');
			for (const cookie of cookies) {
				const [key, value] = cookie.trim().split('=');
				if (key === 'token' && value) {
					pb.authStore.save(value);
					// Also store in localStorage for future use
					localStorage.setItem('pb_token', value);
					break;
				}
			}
		}
	}
	
	return pb;
}



export async function validatePocketbase(token: string | undefined) {
	if (!token) {
		return {
			pb: null,
			valid: false,
		}
	}
	const pb = new PocketBase("https://pb.sercan.co.uk")
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
