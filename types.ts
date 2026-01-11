
export enum AppStep {
  HOME = 'HOME',
  BEFORE_CAPTURE = 'BEFORE_CAPTURE',
  CLEANING = 'CLEANING',
  AFTER_CAPTURE = 'AFTER_CAPTURE',
  RESULT = 'RESULT',
  CHAT = 'CHAT'
}

export interface SessionData {
  beforeImage: string | null;
  afterImage: string | null;
  startTime: number | null;
  endTime: number | null;
  mergedImage: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
