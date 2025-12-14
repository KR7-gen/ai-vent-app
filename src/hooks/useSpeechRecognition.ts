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
  onRecognized?: (transcript: string) => void,
  isStreaming?: boolean
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
      // 配信中は常に再起動を許可
      shouldRestartRef.current = true;
      // 既に起動している場合は一度停止してから再起動
      try {
        recognition.stop();
      } catch (e) {
        // 停止に失敗しても続行（既に停止している可能性がある）
      }
      // 少し待ってから再起動（ブラウザの制限を回避）
      setTimeout(() => {
        try {
          recognition.start();
          console.log('[SpeechRecognition] Started successfully');
        } catch (err) {
          console.error('Error starting speech recognition:', err);
          // エラーが発生した場合、少し待ってから再試行
          setTimeout(() => {
            try {
              recognition.start();
              console.log('[SpeechRecognition] Restarted after error');
            } catch (retryErr) {
              console.error('Error restarting speech recognition:', retryErr);
              setError('音声認識の開始に失敗しました。');
            }
          }, 1000);
        }
      }, 100);
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
      console.error('[SpeechRecognition] Error:', event.error);
      // no-speech や aborted は正常な動作の一部なので無視
      // ただし、長時間 no-speech が続くと音声認識が停止する可能性があるため、
      // shouldRestartRef が true の場合は onend で再起動される
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`音声認識エラー: ${event.error}`);
        // 重大なエラーの場合でも、shouldRestartRef が true なら再起動を試みる
        if (shouldRestartRef.current && (event.error === 'network' || event.error === 'service-not-allowed')) {
          console.log('[SpeechRecognition] Critical error, will retry on end');
        }
      }
    };

    recognition.onend = () => {
      // 配信中は常に再起動（無言で自動停止した場合でも）
      const shouldRestart = shouldRestartRef.current || (isStreaming ?? false);
      console.log('[SpeechRecognition] Recognition ended, shouldRestart:', shouldRestartRef.current, 'isStreaming:', isStreaming);
      
      if (shouldRestart) {
        // 配信中の場合、shouldRestartRef を true に保つ
        if (isStreaming) {
          shouldRestartRef.current = true;
        }
        
        // 少し待ってから再起動（ブラウザの制限を回避）
        setTimeout(() => {
          try {
            recognition.start();
            console.log('[SpeechRecognition] Auto-restarted after end');
          } catch (err) {
            console.error('Error restarting recognition:', err);
            // 再起動に失敗した場合、もう一度試行
            setTimeout(() => {
              const shouldRetry = shouldRestartRef.current || (isStreaming ?? false);
              if (shouldRetry) {
                // 配信中の場合、shouldRestartRef を true に保つ
                if (isStreaming) {
                  shouldRestartRef.current = true;
                }
                try {
                  recognition.start();
                  console.log('[SpeechRecognition] Retried restart after error');
                } catch (retryErr) {
                  console.error('Error retrying recognition restart:', retryErr);
                }
              }
            }, 1000);
          }
        }, 100);
      } else {
        console.log('[SpeechRecognition] Not restarting (shouldRestart=false, isStreaming=false)');
      }
    };

    recognitionRef.current = recognition;
    setError(null);
    
    // 配信状態が変わったら shouldRestartRef を更新
    if (isStreaming) {
      shouldRestartRef.current = true;
    }
  }, [onRecognized, isStreaming]);

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

