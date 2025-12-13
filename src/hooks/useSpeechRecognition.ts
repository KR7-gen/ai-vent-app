'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface UseSpeechRecognitionResult {
  error: string | null;
  startRecognition: () => void;
  stopRecognition: () => void;
}

export const useSpeechRecognition = (
  onRecognized?: (transcript: string) => void
): UseSpeechRecognitionResult => {
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('音声認識が初期化されていません。Chromeをご利用ください。');
      return;
    }

    try {
      shouldRestartRef.current = true;
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('音声認識の開始に失敗しました。');
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    shouldRestartRef.current = false;
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
      setError('音声認識の停止に失敗しました。');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Speech recognition not supported');
      setError('お使いのブラウザは音声認識に対応していません。Chromeをご利用ください。');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // final 判定の時にtranscriptを取得してコールバックに渡す
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          if (onRecognized && transcript) {
            onRecognized(transcript);
          }
          break;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`音声認識エラー: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.error('Error restarting recognition:', err);
        }
      }
    };

    recognitionRef.current = recognition;
    setError(null);
  }, [onRecognized]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Error stopping recognition on cleanup:', err);
        }
      }
    };
  }, []);

  return {
    error,
    startRecognition,
    stopRecognition,
  };
};

export type UseSpeechRecognitionHook = ReturnType<typeof useSpeechRecognition>;

