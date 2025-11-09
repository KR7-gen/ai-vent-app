// 共通の型定義

export interface Comment {
  id: string;
  text: string;
  special: boolean;
  timestamp: number;
  userName?: string;
  isUserComment?: boolean;
}

export interface BackgroundOption {
  id: string;
  name: string;
  gradient: string;
}

export interface BackgroundPreview {
  id: string;
  name: string;
  preview: string;
}

export type DisplayMode = 'background' | 'camera';

export type RoomMode = 'create' | 'join';

export interface AgreementState {
  secrecy: boolean;
  ethics: boolean;
  notAdvice: boolean;
  noRecording: boolean;
  ageConfirm: boolean;
  allAgree: boolean;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export interface StreamState {
  isStreaming: boolean;
  streamTime: number;
  silenceTime: number;
  audioLevel: number;
  isRecording: boolean;
  backgroundImage: string;
  lastAudioTime: number | null;
  error: string | null;
  showConfirmEnd: boolean;
}