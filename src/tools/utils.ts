import fs from 'fs';
import path from 'path';

export const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const addSecondsToTime = (timeStr: string, secondsToAdd: number) => {
  const [h, m, s] = timeStr.split(':').map(Number);
  const totalSeconds = h * 3600 + m * 60 + s + secondsToAdd;
  const newH = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const newM = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const newS = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${newH}:${newM}:${newS}`;
};