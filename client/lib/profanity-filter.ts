const PROFANITY_WORDS = [
  "badword1",
  "badword2",
];

const PROFANITY_REGEX = new RegExp(
  PROFANITY_WORDS.map(word => `\\b${word}\\b`).join("|"),
  "gi"
);

export function containsProfanity(text: string): boolean {
  return PROFANITY_REGEX.test(text);
}

export function filterProfanity(text: string): string {
  return text.replace(PROFANITY_REGEX, (match) => "*".repeat(match.length));
}

export function validateMessage(content: string): { valid: boolean; error?: string } {
  if (!content.trim()) {
    return { valid: false, error: "Message cannot be empty" };
  }
  
  if (content.length > 2000) {
    return { valid: false, error: "Message is too long (max 2000 characters)" };
  }
  
  if (containsProfanity(content)) {
    return { valid: false, error: "Message contains inappropriate language" };
  }
  
  return { valid: true };
}
