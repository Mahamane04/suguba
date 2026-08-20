'use client';

import { sugubaStore } from './store';
import { UserRole } from '@/types';

export interface UserProfile {
  id: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: 'pending_approval' | 'active' | 'suspended' | 'rejected';
  resellerCode?: string;
  city: string;
  balance?: number;
  createdAt: string;
}

/**
 * Réécrit pour corriger BUG-002 et BUG-003 : toute la logique de génération
 * et de vérification du code vit désormais côté serveur
 * (/api/auth/request-otp, /api/auth/verify-otp). Ce service n'est plus
 * qu'un client HTTP fin — il ne voit jamais le code, ne décide jamais du
 * rôle attribué, et ne peut plus faire "succès" par défaut sur une erreur.
 */
class AuthService {
  public async requestOtp(phone: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, channel }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Erreur lors de l'envoi du code." };
      }
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: 'Une erreur réseau est survenue.' };
    }
  }

  public async verifyOtpAndSyncProfile(
    phone: string,
    token: string,
    intendedRole: UserRole = 'reseller'
  ): Promise<{
    success: boolean;
    profile?: UserProfile;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: token, intendedRole }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Code OTP invalide.' };
      }

      // Le rôle vient désormais exclusivement de la réponse serveur (issue
      // de la session signée), jamais d'un choix client.
      sugubaStore.switchRole(data.role as UserRole);

      const profile: UserProfile = {
        id: data.uid || `usr-${phone}`,
        phone,
        fullName: data.fullName || 'Utilisateur Suguba',
        role: data.role as UserRole,
        status: data.status || 'pending_approval',
        city: 'Bamako',
        createdAt: new Date().toISOString(),
      };
      return { success: true, profile };
    } catch (err) {
      return { success: false, error: 'Une erreur réseau est survenue.' };
    }
  }

  public async signOut(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    sugubaStore.switchRole('reseller');
  }
}

export const authService = new AuthService();
