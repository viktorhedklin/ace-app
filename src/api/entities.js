// Local mode — no backend auth required
export const User = {
  me: async () => ({ id: 'local', email: 'local@ace', name: 'Ace Agent' }),
  logout: () => { window.location.reload(); },
};
