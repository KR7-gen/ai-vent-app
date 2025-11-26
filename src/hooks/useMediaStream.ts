'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMediaStreamResult {
  stream: MediaStream | null;
  isLoading: boolean;
  permissionGranted: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

export const useMediaStream = (): UseMediaStreamResult => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setPermissionGranted(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setPermissionGranted(true);
    } catch (err) {
      console.error('Error accessing media devices:', err);

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('カメラとマイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
            break;
          case 'NotFoundError':
            setError('カメラまたはマイクが見つかりませんでした。デバイスが接続されているか確認してください。');
            break;
          case 'NotReadableError':
            setError('カメラまたはマイクが別のアプリケーションで使用中の可能性があります。');
            break;
          default:
            setError(`エラーが発生しました: ${err.message}`);
        }
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    isLoading,
    permissionGranted,
    error,
    startCamera,
    stopCamera,
  };
};

export type UseMediaStreamHook = ReturnType<typeof useMediaStream>;

