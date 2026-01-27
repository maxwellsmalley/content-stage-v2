import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function register(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}
