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
  onstart: (() => void) | null;
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
  const isRunningRef = useRef(false);
  const isStartingRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // クリーンアップ: タイマーをクリア
  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('音声認識が初期化されていません。Chromeをご利用ください。');
      return;
    }

    // 既に開始中または実行中の場合は何もしない
    if (isStartingRef.current || isRunningRef.current) {
      console.log('[SpeechRecognition] Already starting or running, skipping start');
      return;
    }

    try {
      // 配信中は常に再起動を許可
      shouldRestartRef.current = true;
      isStartingRef.current = true;
      
      // 既に起動している場合は一度停止してから再起動
      try {
        if (isRunningRef.current) {
          recognition.stop();
          isRunningRef.current = false;
        }
      } catch (e) {
        // 停止に失敗しても続行（既に停止している可能性がある）
        isRunningRef.current = false;
      }
      
      // 少し待ってから再起動（ブラウザの制限を回避）
      clearRestartTimeout();
      restartTimeoutRef.current = setTimeout(() => {
        try {
          recognition.start();
          console.log('[SpeechRecognition] Started successfully');
        } catch (err: any) {
          console.error('Error starting speech recognition:', err);
          isStartingRef.current = false;
          // InvalidStateErrorの場合は既に開始されている可能性がある
          if (err.name === 'InvalidStateError') {
            console.log('[SpeechRecognition] Already started, setting isRunning to true');
            isRunningRef.current = true;
          } else {
            // その他のエラーの場合、少し待ってから再試行
            setTimeout(() => {
              if (!isRunningRef.current && !isStartingRef.current) {
                try {
                  recognition.start();
                  console.log('[SpeechRecognition] Restarted after error');
                } catch (retryErr) {
                  console.error('Error restarting speech recognition:', retryErr);
                  isStartingRef.current = false;
                  setError('音声認識の開始に失敗しました。');
                }
              }
            }, 1000);
          }
        }
      }, 100);
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      isStartingRef.current = false;
      setError('音声認識の開始に失敗しました。');
    }
  }, [clearRestartTimeout]);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    shouldRestartRef.current = false;
    clearRestartTimeout();
    isStartingRef.current = false;
    try {
      recognitionRef.current.stop();
      isRunningRef.current = false;
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
      isRunningRef.current = false;
      setError('音声認識の停止に失敗しました。');
    }
  }, [clearRestartTimeout]);

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

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Recognition started');
      isRunningRef.current = true;
      isStartingRef.current = false;
    };

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
      const errorCode = event.error;
      console.error('[SpeechRecognition] Error:', errorCode);
      
      // aborted エラーは状態をリセット（正常な動作の一部）
      if (errorCode === 'aborted') {
        console.log('[SpeechRecognition] Recognition aborted (normal during restart)');
        isRunningRef.current = false;
        isStartingRef.current = false;
        return; // abortedは正常な動作なので処理を終了
      }
      
      // no-speech は正常な動作（一定時間音声が検出されない）
      if (errorCode === 'no-speech') {
        console.log('[SpeechRecognition] No speech detected (normal)');
        return; // no-speechは正常な動作なので処理を終了
      }
      
      // その他のエラーはユーザーに通知
      let errorMessage = '';
      switch (errorCode) {
        case 'audio-capture':
          errorMessage = 'マイクにアクセスできません。マイクの設定を確認してください。';
          break;
        case 'network':
          errorMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
          break;
        case 'not-allowed':
          errorMessage = 'マイクの使用が許可されていません。ブラウザの設定を確認してください。';
          break;
        case 'service-not-allowed':
          errorMessage = '音声認識サービスが利用できません。';
          break;
        default:
          errorMessage = `音声認識エラー: ${errorCode}`;
      }
      
      console.error('[SpeechRecognition] Error details:', {
        error: errorCode,
        message: errorMessage,
        isStreaming: isStreaming,
        shouldRestart: shouldRestartRef.current
      });
      
      setError(errorMessage);
      
      // 重大なエラーの場合でも、shouldRestartRef が true なら再起動を試みる
      if (shouldRestartRef.current && (errorCode === 'network' || errorCode === 'service-not-allowed')) {
        console.log('[SpeechRecognition] Critical error, will retry on end');
      }
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Recognition ended');
      isRunningRef.current = false;
      isStartingRef.current = false;
      
      // 配信中は常に再起動（無言で自動停止した場合でも）
      const shouldRestart = shouldRestartRef.current || (isStreaming ?? false);
      console.log('[SpeechRecognition] shouldRestart:', shouldRestartRef.current, 'isStreaming:', isStreaming);
      
      if (shouldRestart) {
        // 配信中の場合、shouldRestartRef を true に保つ
        if (isStreaming) {
          shouldRestartRef.current = true;
        }
        
        // 既に開始中の場合はスキップ
        if (isStartingRef.current) {
          console.log('[SpeechRecognition] Already starting, skipping auto-restart');
          return;
        }
        
        // 少し待ってから再起動（ブラウザの制限を回避）
        clearRestartTimeout();
        restartTimeoutRef.current = setTimeout(() => {
          // 再チェック: この時点で既に開始中または実行中でないことを確認
          if (isStartingRef.current || isRunningRef.current) {
            console.log('[SpeechRecognition] Already running/starting, skipping restart');
            return;
          }
          
          try {
            isStartingRef.current = true;
            recognition.start();
            console.log('[SpeechRecognition] Auto-restarted after end');
          } catch (err: any) {
            console.error('Error restarting recognition:', err);
            isStartingRef.current = false;
            
            // InvalidStateErrorの場合は既に開始されている可能性がある
            if (err.name === 'InvalidStateError') {
              console.log('[SpeechRecognition] Already started (InvalidStateError), setting isRunning to true');
              isRunningRef.current = true;
            } else {
              // その他のエラーの場合、もう一度試行
              setTimeout(() => {
                const shouldRetry = shouldRestartRef.current || (isStreaming ?? false);
                if (shouldRetry && !isRunningRef.current && !isStartingRef.current) {
                  try {
                    isStartingRef.current = true;
                    recognition.start();
                    console.log('[SpeechRecognition] Retried restart after error');
                  } catch (retryErr: any) {
                    console.error('Error retrying recognition restart:', retryErr);
                    isStartingRef.current = false;
                    if (retryErr.name === 'InvalidStateError') {
                      isRunningRef.current = true;
                    }
                  }
                }
              }, 1000);
            }
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
      clearRestartTimeout();
      isStartingRef.current = false;
      isRunningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Error stopping recognition on cleanup:', err);
        }
      }
    };
  }, [clearRestartTimeout]);

  return {
    error,
    startRecognition,
    stopRecognition,
  };
};

export type UseSpeechRecognitionHook = ReturnType<typeof useSpeechRecognition>;

