import { supabase, signInWithGoogle } from './supabase';

describe('supabase', () => {
  it('should have auth methods', () => {
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.auth.getUser).toBe('function');
    expect(typeof supabase.auth.onAuthStateChange).toBe('function');
    expect(typeof supabase.auth.signOut).toBe('function');
    expect(typeof supabase.auth.exchangeCodeForSession).toBe('function');
    expect(typeof supabase.auth.signInWithOAuth).toBe('function');
  });

  describe('auth.getUser', () => {
    it('should return null user', async () => {
      const result = await supabase.auth.getUser();
      expect(result).toEqual({ data: { user: null } });
    });
  });

  describe('auth.onAuthStateChange', () => {
    it('should return a subscription object with unsubscribe method', () => {
      const result = supabase.auth.onAuthStateChange();
      expect(result.data.subscription).toBeDefined();
      expect(typeof result.data.subscription.unsubscribe).toBe('function');
    });

    it('should have unsubscribe method that does not throw', () => {
      const result = supabase.auth.onAuthStateChange();
      expect(() => result.data.subscription.unsubscribe()).not.toThrow();
    });
  });

  describe('auth.signOut', () => {
    it('should return no error', async () => {
      const result = await supabase.auth.signOut();
      expect(result).toEqual({ error: null });
    });
  });

  describe('auth.exchangeCodeForSession', () => {
    it('should return no error', async () => {
      const result = await supabase.auth.exchangeCodeForSession();
      expect(result).toEqual({ error: null });
    });
  });

  describe('auth.signInWithOAuth', () => {
    it('should return null data and no error', async () => {
      const result = await supabase.auth.signInWithOAuth();
      expect(result).toEqual({ data: null, error: null });
    });
  });

  describe('supabase.from', () => {
    it('should return an object with select method', () => {
      const query = supabase.from('test');
      expect(query).toBeDefined();
      expect(typeof query.select).toBe('function');
    });

    describe('select method', () => {
      it('should return an object with eq method', () => {
        const query = supabase.from('test');
        const selectResult = query.select();
        expect(typeof selectResult.eq).toBe('function');
      });

      describe('eq method', () => {
        it('should return an object with single and maybeSingle methods', async () => {
          const query = supabase.from('test');
          const selectResult = query.select();
          const eqResult = selectResult.eq('id', 1);

          expect(typeof eqResult.single).toBe('function');
          expect(typeof eqResult.maybeSingle).toBe('function');

          expect(await eqResult.single()).toBeNull();
          expect(await eqResult.maybeSingle()).toBeNull();
        });
      });
    });

    describe('update method', () => {
      it('should return an object with eq method', async () => {
        const query = supabase.from('test');
        const updateResult = query.update({});
        expect(typeof updateResult.eq).toBe('function');

        const eqResult = updateResult.eq('id', 1);
        expect(typeof eqResult.select).toBe('function');

        const selectResult = eqResult.select();
        expect(typeof selectResult.single).toBe('function');

        expect(await selectResult.single()).toBeNull();
      });
    });
  });

  describe('supabase.channel', () => {
    it('should return an object with on method', () => {
      const channel = supabase.channel('test');
      expect(channel).toBeDefined();
      expect(typeof channel.on).toBe('function');
    });

    describe('channel.on', () => {
      it('should return an object with subscribe method', () => {
        const channel = supabase.channel('test');
        const onResult = channel.on();
        expect(typeof onResult.subscribe).toBe('function');
      });

      describe('subscribe method', () => {
        it('should return an object with unsubscribe method', () => {
          const channel = supabase.channel('test');
          const onResult = channel.on();
          const subscribeResult = onResult.subscribe();
          
          expect(typeof subscribeResult.unsubscribe).toBe('function');
          expect(() => subscribeResult.unsubscribe()).not.toThrow();
        });
      });
    });
  });
});

describe('signInWithGoogle', () => {
  it('should log a message and return null data', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const result = await signInWithGoogle();
    
    expect(consoleSpy).toHaveBeenCalledWith("Sign in with Google not available in open-source version");
    expect(result).toEqual({ data: null });
    
    consoleSpy.mockRestore();
  });
});