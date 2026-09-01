import { UserFormData, UserValidationErrors } from "../types/user";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format.
 */
export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Password strength rules as per specification:
 * Minimum 10 characters, uppercase, lowercase, number, symbol
 */
export function validatePasswordStrength(password: string): boolean {
  if (!password || password.length < 10) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSymbol;
}

/**
 * Generates a cryptographically-secure temporary password meeting password strength rules.
 */
export function generateTemporaryPassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";

  const getRandomInt = (max: number) => Math.floor(Math.random() * max);
  const getRandomChar = (charset: string) => charset.charAt(getRandomInt(charset.length));

  const passwordChars = [
    getRandomChar(uppers),
    getRandomChar(lowers),
    getRandomChar(numbers),
    getRandomChar(symbols),
  ];

  const allChars = uppers + lowers + numbers + symbols;
  for (let i = 4; i < 12; i++) {
    passwordChars.push(getRandomChar(allChars));
  }

  // Fisher-Yates shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join("");
}

/**
 * Validates UserFormData for creation and updates.
 */
export function validateUserFormData(data: UserFormData): UserValidationErrors | null {
  const errors: UserValidationErrors = {};

  if (!data.email || !data.email.trim()) {
    errors.email = "Email address is required";
  } else if (!validateEmail(data.email)) {
    errors.email = "Please enter a valid email address";
  }

  if (!data.roleId || !data.roleId.trim()) {
    errors.roleId = "Role selection is required";
  }

  if (data.name !== undefined && data.name !== null && data.name.trim().length > 255) {
    errors.name = "Name cannot exceed 255 characters";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
