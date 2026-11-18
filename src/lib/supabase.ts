// This file has been emptied to remove Supabase dependencies.
// The open-source version uses local configuration instead.

// Export empty objects to prevent import errors in case any components still reference this file
export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    exchangeCodeForSession: async () => ({ error: null }),
    signInWithOAuth: async () => ({ data: null, error: null })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => null,
        maybeSingle: async () => null
      })
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: async () => null
        })
      })
    })
  }),
  channel: () => ({
    on: () => ({
      subscribe: () => ({
        unsubscribe: () => {}
      })
    })
  })
};

export const signInWithGoogle = async () => {
  console.log("开源版本不提供 Google 登录");
  return { data: null };
};
