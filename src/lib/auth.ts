export type UserRole = 'admin' | 'client';

export type AppUser = {
  username: string;
  password: string;
  role: UserRole;
};

const ADMIN_USERNAME = 'Ranjith';
const ADMIN_PASSWORD = 'RK@2026';
const CLIENT_USERNAME = 'Guna';
const CLIENT_PASSWORD = 'GM@2026';

export const USERS_KEY = 'guna_users';
export const CURRENT_USER_KEY = 'guna_current_user';

const buildDefaultUsers = (): AppUser[] => [
  { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: 'admin' },
  { username: CLIENT_USERNAME, password: CLIENT_PASSWORD, role: 'client' },
];

export function getUsers(): AppUser[] {
  if (typeof window === 'undefined') return buildDefaultUsers();

  const saved = localStorage.getItem(USERS_KEY);
  if (!saved) {
    localStorage.setItem(USERS_KEY, JSON.stringify(buildDefaultUsers()));
    return buildDefaultUsers();
  }

  try {
    const parsed = JSON.parse(saved) as AppUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = buildDefaultUsers();
      localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return parsed;
  } catch {
    const defaults = buildDefaultUsers();
    localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function saveUsers(users: AppUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): { username: string; role: UserRole } | null {
  if (typeof window === 'undefined') return null;

  const value = localStorage.getItem(CURRENT_USER_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as { username: string; role: UserRole };
  } catch {
    return null;
  }
}

export function setCurrentUser(user: { username: string; role: UserRole } | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function login(username: string, password: string) {
  const users = getUsers();
  const match = users.find(
    (user) =>
      user.username.trim().toLowerCase() === username.trim().toLowerCase() &&
      user.password === password
  );

  if (!match) {
    throw new Error('Invalid username or password.');
  }

  const sessionUser = {
    username: match.username,
    role: match.role,
  };

  setCurrentUser(sessionUser);
  return sessionUser;
}

export function logout() {
  setCurrentUser(null);
}

export function isAdminUser() {
  const current = getCurrentUser();
  return current?.role === 'admin';
}

export function updateClientCredentials(newUsername: string, newPassword: string) {
  const users = getUsers();
  const clientUser = users.find((user) => user.role === 'client');

  if (!clientUser) {
    throw new Error('Client user not found.');
  }

  clientUser.username = newUsername.trim();
  clientUser.password = newPassword.trim();

  saveUsers(users);

  const current = getCurrentUser();
  if (current?.role === 'client' && current.username === 'Guna') {
    setCurrentUser({ username: newUsername.trim(), role: 'client' });
  }
}
