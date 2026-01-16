import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase } from './client';
import type { Profile } from '../types/database';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export interface SignUpData {
  email: string;
  password: string;
  handle: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp(data: SignUpData): Promise<AuthResult> {
  const supabase = getSupabase();
  
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        handle: data.handle,
      },
    },
  });

  return {
    user: authData.user,
    session: authData.session,
    error,
  };
}

export async function signIn(data: SignInData): Promise<AuthResult> {
  const supabase = getSupabase();
  
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  return {
    user: authData.user,
    session: authData.session,
    error,
  };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function getUser(): Promise<{ user: User | null; error: AuthError | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabase();
  
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (profileError) return null;
  return profile;
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { unsubscribe: () => void } {
  const supabase = getSupabase();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}

export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}
