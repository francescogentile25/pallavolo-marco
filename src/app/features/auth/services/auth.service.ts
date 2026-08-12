import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CompleteRegistrationRequest, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';

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
          city: request.city.trim(),
          city_latitude: request.cityLatitude,
          city_longitude: request.cityLongitude,
          city_place_id: request.cityPlaceId,
        },
        emailRedirectTo: window.location.origin + '/login',
      },
    });
  }

  signInWithGoogle(redirectTo: string) {
    return this.supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }

  async completeRegistration(request: CompleteRegistrationRequest): Promise<UserProfile> {
    const { data, error } = await this.supabase.client.rpc('complete_my_registration', {
      p_nome: request.nome.trim(),
      p_cognome: request.cognome.trim(),
      p_city: request.city.trim(),
      p_latitude: request.cityLatitude,
      p_longitude: request.cityLongitude,
      p_place_id: request.cityPlaceId,
    });
    if (error) throw error;
    return data as UserProfile;
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
