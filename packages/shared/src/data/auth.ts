/**
 * Email + password auth. Kept behind these functions so phone OTP
 * (signInWithPhoneNumber) can be added later without touching screens.
 */
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import { loginSchema, signUpSchema, validate, type SignUpInput } from "../validation";
import { ValidationFailed } from "./errors";
import { defaultProfileFields } from "./mutations";
import { userDoc } from "./refs";

export async function signUp(auth: Auth, db: Firestore, input: SignUpInput): Promise<User> {
  const result = validate(signUpSchema, input);
  if (!result.ok) throw new ValidationFailed(result.errors as Record<string, string>);
  const { name, email, password } = result.data;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateAuthProfile(credential.user, { displayName: name });
  await setDoc(userDoc(db, credential.user.uid), {
    ...defaultProfileFields(email, name),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return credential.user;
}

export async function logIn(auth: Auth, input: { email: string; password: string }): Promise<User> {
  const result = validate(loginSchema, input);
  if (!result.ok) throw new ValidationFailed(result.errors as Record<string, string>);
  const credential = await signInWithEmailAndPassword(auth, result.data.email, result.data.password);
  return credential.user;
}

export function logOut(auth: Auth): Promise<void> {
  return firebaseSignOut(auth);
}

/** Always resolves (even for unknown emails) so the UI can't be used to discover accounts. */
export async function requestPasswordReset(auth: Auth, email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/user-not-found") return;
    throw error;
  }
}

/** Creates the profile document if sign-up was interrupted before it was written. */
export async function ensureProfile(db: Firestore, user: User): Promise<void> {
  const ref = userDoc(db, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    ...defaultProfileFields(user.email ?? "", user.displayName ?? user.email?.split("@")[0] ?? "Friend"),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
