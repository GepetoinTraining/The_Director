import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');
const CHAT_FILE = path.join(DB_PATH, 'chat_history.json');

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

export function getChatHistory() {
  if (!fs.existsSync(CHAT_FILE)) return [];
  try {
    const data = fs.readFileSync(CHAT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveChatHistory(messages: any[]) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
}

export function clearChatHistory() {
  if (fs.existsSync(CHAT_FILE)) fs.unlinkSync(CHAT_FILE);
}