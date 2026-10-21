import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Sector, User, UserRole } from '@/types';

interface AuthLink {
  user_id: string;
  role?: UserRole;
  active?: boolean;
}

const normalizeUsername = (value: string) => value.trim().toLowerCase();

export function usernameToAuthEmail(username: string): string {
  const normalized = normalizeUsername(username)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '.');

  return `${normalized}@japanflow.local`;
}

function mapProfile(id: string, data: Record<string, unknown>, firebaseUser: FirebaseUser): User {
  return {
    id,
    name: String(data.name || firebaseUser.displayName || 'Usuário'),
    username: String(data.username || '').trim(),
    role: (data.role === 'admin' ? 'admin' : 'employee') as UserRole,
    avatar: typeof data.avatar === 'string' && data.avatar ? data.avatar : undefined,
    sectors: (Array.isArray(data.sectors) ? data.sectors : []) as Sector[],
    function: typeof data.function === 'string' && data.function ? data.function : undefined,
    backgroundColor:
      typeof data.backgroundColor === 'string'
        ? data.backgroundColor
        : typeof data.background_color === 'string'
          ? data.background_color
          : undefined,
    authUid: firebaseUser.uid,
    authEmail: firebaseUser.email || undefined,
    active: data.active !== false,
  };
}

async function loadProfile(firebaseUser: FirebaseUser): Promise<User> {
  const linkRef = doc(db, 'auth_links', firebaseUser.uid);
  const linkSnap = await getDoc(linkRef);

  if (!linkSnap.exists()) {
    throw new Error('Conta sem vínculo com um usuário do ERP.');
  }

  const link = linkSnap.data() as AuthLink;
  if (!link.user_id || link.active === false) {
    throw new Error('Acesso desativado.');
  }

  const profileRef = doc(db, 'users', link.user_id);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    throw new Error('Perfil do ERP não encontrado.');
  }

  const profile = mapProfile(profileSnap.id, profileSnap.data(), firebaseUser);
  if (!profile.active) {
    throw new Error('Acesso desativado.');
  }

  return profile;
}

export async function loginUser(username: string, password: string): Promise<User> {
  const email = usernameToAuthEmail(username);
  const credential = await signInWithEmailAndPassword(auth, email, password);

  try {
    return await loadProfile(credential.user);
  } catch (error) {
    await firebaseSignOut(auth).catch(() => undefined);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void,
  onReady?: () => void
) {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    try {
      if (!firebaseUser) {
        callback(null);
        return;
      }

      const profile = await loadProfile(firebaseUser);
      callback(profile);
    } catch (error) {
      console.warn('Falha ao carregar perfil da sessão Firebase:', error);
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      // Falhas transitorias nao devem revogar uma autenticacao valida.
      // Firestore Rules continuam protegendo dados enquanto o perfil nao carrega.
      const transientCodes = new Set([
        'unavailable',
        'deadline-exceeded',
        'resource-exhausted',
        'cancelled',
        'firestore/unavailable',
        'firestore/deadline-exceeded',
        'firestore/resource-exhausted',
        'firestore/cancelled',
      ]);
      if (transientCodes.has(code)) {
        // Nao deslogar por queda de rede. Manter estado anterior ate novo evento Auth.
        return;
      }
      // Contas sem vinculo, desativadas ou acesso negado ainda sao encerradas.
      await firebaseSignOut(auth).catch(() => undefined);
      callback(null);
    } finally {
      onReady?.();
    }
  });
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser?.email) {
    throw new Error('Sessão de autenticação inválida.');
  }

  const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
  await reauthenticateWithCredential(firebaseUser, credential);
  await updatePassword(firebaseUser, newPassword);
}
