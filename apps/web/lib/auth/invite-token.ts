const INVITE_TOKEN_MIN_LENGTH = 20;
const INVITE_TOKEN_MAX_LENGTH = 256;

const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function sanitizeInviteToken(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const token = input.trim();
  if (token.length < INVITE_TOKEN_MIN_LENGTH || token.length > INVITE_TOKEN_MAX_LENGTH) {
    return null;
  }

  if (!INVITE_TOKEN_PATTERN.test(token)) {
    return null;
  }

  return token;
}
