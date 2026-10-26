import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

export interface ChatCountsResponse {
  privateTotal: number;
  privateByPartner: Record<string, number>;
  groupById: Record<string, number>;
}

const functions = getFunctions(app, 'southamerica-east1');
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const getCounts = httpsCallable<{ partnerIds: string[]; groupIds: string[] }, ChatCountsResponse>(
  functions,
  'getChatUnreadCounts'
);

export async function fetchChatCounts(partnerIds: string[], groupIds: string[]) {
  const response = await getCounts({ partnerIds, groupIds });
  return response.data;
}
