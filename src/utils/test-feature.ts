/**
 * Test feature for Claude Code Review
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export function formatUserProfile(user: UserProfile): string {
  return `${user.name} (${user.email}) - Created: ${user.createdAt.toISOString()}`;
}

export function validateUserAge(birthDate: Date): boolean {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  return age >= 18;
}