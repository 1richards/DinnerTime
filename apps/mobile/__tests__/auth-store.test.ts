import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock variables are available before vi.mock factory runs
const { mockOnAuthStateChange, mockSignOut, mockFrom } = vi.hoisted(() => ({
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}));

// Import after mocking
import { useAuthStore } from '../src/stores/authStore';

describe('Auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the zustand store state
    useAuthStore.setState({
      session: null,
      user: null,
      isLoggedIn: false,
      isOnboarded: false,
      isLoading: true,
      profile: null,
    });
  });

  describe('initial state', () => {
    it('should initialize with isLoading=true, isLoggedIn=false, session=null', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.isLoggedIn).toBe(false);
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isOnboarded).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should subscribe to onAuthStateChange and return cleanup function', () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const cleanup = useAuthStore.getState().initialize();

      expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('should set isLoggedIn=true when session is received', async () => {
      let authCallback: (event: string, session: unknown) => void;

      mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      // Profile fetch for onboarding check
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { onboarding_complete: false },
              error: null,
            }),
          }),
        }),
      });

      useAuthStore.getState().initialize();

      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      // Simulate auth state change
      await authCallback!('SIGNED_IN', mockSession);

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockSession.user);
      expect(state.isLoading).toBe(false);
    });

    it('should set isOnboarded based on profile.onboarding_complete', async () => {
      let authCallback: (event: string, session: unknown) => void;

      mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { onboarding_complete: true },
              error: null,
            }),
          }),
        }),
      });

      useAuthStore.getState().initialize();

      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      await authCallback!('SIGNED_IN', mockSession);

      // The store defers the profile fetch via setTimeout(0) so the
      // Supabase auth lock is released before any further supabase.*
      // call — otherwise the .from('profiles') request deadlocks. Yield
      // a microtask so that deferred work fires before we assert.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('should reset to logged-out state when session becomes null', async () => {
      let authCallback: (event: string, session: unknown) => void;

      mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      useAuthStore.getState().initialize();

      // First, simulate login
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { onboarding_complete: true },
              error: null,
            }),
          }),
        }),
      });

      await authCallback!('SIGNED_IN', {
        access_token: 'test-token',
        user: { id: 'user-123', email: 'test@example.com' },
      });

      expect(useAuthStore.getState().isLoggedIn).toBe(true);

      // Now simulate sign out (null session)
      await authCallback!('SIGNED_OUT', null);

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isOnboarded).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('signOut', () => {
    it('should call supabase.auth.signOut and reset state', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      // Set some state first
      useAuthStore.setState({
        isLoggedIn: true,
        session: { access_token: 'test' } as any,
        user: { id: 'user-123' } as any,
        isOnboarded: true,
        isLoading: false,
      });

      await useAuthStore.getState().signOut();

      expect(mockSignOut).toHaveBeenCalledOnce();

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isOnboarded).toBe(false);
    });
  });
});
