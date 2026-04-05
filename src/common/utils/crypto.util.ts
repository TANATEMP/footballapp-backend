import argon2 from 'argon2';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export const hashPassword = async (password: string): Promise<string> => {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  });
};

export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const generateSecureToken = (length = 64): string => {
  return randomBytes(length).toString('hex');
};

export const encryptData = (text: string, keyHex: string): string => {
  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(keyHex, 'hex');
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
};

export const decryptData = (encryptedData: string, keyHex: string): string => {
  try {
    if (!encryptedData.includes(':')) {
      return encryptedData; // fallback for existing plaintext secrets
    }
    
    const [ivHex, encryptedHex, tagHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(keyHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Data decryption failed');
  }
};
