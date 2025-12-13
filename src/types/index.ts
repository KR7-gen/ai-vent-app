// 共通の型定義

export interface Comment {
  id: string;
  text?: string;
  special: boolean;
  timestamp: number;
  userName?: string;
  isUserComment?: boolean;
  stampSrc?: string; // スタンプの場合の画像パス
  role?: 'assistant' | 'user'; // アシスタント（Bot）かユーザーか
  type?: 'gpt' | 'aizuchi'; // GPT応答か相槌か
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

export interface Stamp {
  id: string;
  src: string;
  x: number; // パーセンテージ
  y: number; // パーセンテージ
  width?: number; // オプション: サイズ指定
  height?: number; // オプション: サイズ指定
}

export interface StampOption {
  id: string;
  name: string;
  src: string;
  type: 'image' | 'gif';
}

export type AizuchiTag = 'ack' | 'agree' | 'praise' | 'empathy' | 'surprise' | 'prompt';

export interface Aizuchi {
  text: string;
  tags: AizuchiTag[];
}