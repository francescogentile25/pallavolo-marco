import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  login(request: LoginRequest) {
    return this.supabase.client.auth.signInWithPassword(request);
  }

  register(request: RegisterRequest) {
    return this.supabase.client.auth.signUp({
      email: request.email,
      password: request.password,
      options: {
        data: {
          nome: request.nome.trim(),
          cognome: request.cognome.trim(),
        },
        emailRedirectTo: window.location.origin + '/login',
      },
    });
  }

  logout() {
    return this.supabase.client.auth.signOut();
  }

  getSession() {
    return this.supabase.client.auth.getSession();
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<UserProfile>();

    if (error) {
      throw error;
    }

    return data;
  }
}
