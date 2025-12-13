'use client';

import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export default function WebRTCTestPage() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('未接続');

  useEffect(() => {
    // ローカルメディアストリームの取得
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error('Error accessing media devices:', err);
        setConnectionStatus('メディアデバイスの取得に失敗しました');
      });

    // Socket.io クライアントの初期化
    const socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnectionStatus('接続済み');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
      setConnectionStatus('切断されました');
    });

    // 他のユーザーが参加したとき
    socket.on('user-joined', (data: { socketId: string }) => {
      console.log('User joined:', data.socketId);
      setConnectionStatus('他のユーザーが参加しました。接続を開始してください。');
    });

    // 既存のユーザーがいることを通知されたとき
    socket.on('existing-users', (data: { users: string[] }) => {
      console.log('Existing users:', data.users);
      setConnectionStatus('既存のユーザーがいます。接続を開始してください。');
    });

    // サーバーからoffer作成を促されたとき
    socket.on('create-offer', async (data: { targetSocketId: string }) => {
      console.log('Server requested to create offer for:', data.targetSocketId);
      remoteSocketIdRef.current = data.targetSocketId;
      if (!peerConnectionRef.current) {
        createPeerConnection();
      }

      if (peerConnectionRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);

          socket.emit('webrtc-offer', {
            offer: offer,
            socketId: socket.id,
            targetSocketId: data.targetSocketId,
          });

          setConnectionStatus('Offer を作成して送信しました...');
        } catch (err) {
          console.error('Error creating offer:', err);
          setConnectionStatus('Offer 作成に失敗しました');
        }
      }
    });

    // WebRTC offer を受信
    socket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit; socketId: string }) => {
      console.log('Offer received from:', data.socketId);
      remoteSocketIdRef.current = data.socketId;
      if (!peerConnectionRef.current) {
        createPeerConnection();
      }

      try {
        await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnectionRef.current!.createAnswer();
        await peerConnectionRef.current!.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          answer: answer,
          socketId: socket.id,
          targetSocketId: data.socketId,
        });

        setConnectionStatus('Answer を送信しました...');
      } catch (err) {
        console.error('Error handling offer:', err);
        setConnectionStatus('Answer 作成に失敗しました');
      }
    });

    // WebRTC answer を受信
    socket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit; socketId: string }) => {
      console.log('Answer received from:', data.socketId);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setConnectionStatus('接続完了');
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      }
    });

    // ICE candidate を受信
    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; socketId: string }) => {
      console.log('ICE candidate received from:', data.socketId);
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    // ユーザーが退出したとき
    socket.on('user-left', (data: { socketId: string }) => {
      console.log('User left:', data.socketId);
      setConnectionStatus('他のユーザーが退出しました');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setIsCallActive(false);
    });

    // クリーンアップ
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = () => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    // ローカルストリームのトラックを追加
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // リモートストリームの処理
    peerConnection.ontrack = (event) => {
      console.log('Remote track received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // ICE candidate の処理
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && remoteSocketIdRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate.toJSON(),
          socketId: socketRef.current.id,
          targetSocketId: remoteSocketIdRef.current,
        });
      }
    };

    // 接続状態の監視
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      setConnectionStatus(`接続状態: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        setIsCallActive(true);
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        setIsCallActive(false);
      }
    };
  };

  const handleStartConnection = async () => {
    if (!socketRef.current || !isConnected) {
      alert('Socket が接続されていません');
      return;
    }

    // PeerConnection を作成（まだ作成されていない場合）
    if (!peerConnectionRef.current) {
      createPeerConnection();
    }

    // シグナリングサーバーに参加を通知
    // サーバー側で既存ユーザーの有無を確認し、適切にoffer/answerの交換を促す
    socketRef.current.emit('join');
    setConnectionStatus('参加しました。接続を待っています...');
  };

  const handleEndConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsCallActive(false);
    setConnectionStatus('接続を終了しました');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">WebRTC テストページ</h1>

        <div className="mb-4 text-center">
          <p className="text-lg">状態: {connectionStatus}</p>
          <p className="text-sm text-gray-400 mt-2">
            {isConnected ? '✓ Socket 接続済み' : '✗ Socket 未接続'}
          </p>
        </div>

        <div className="flex gap-4 mb-6 justify-center">
          <button
            onClick={handleStartConnection}
            disabled={!isConnected || isCallActive}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            接続開始
          </button>
          <button
            onClick={handleEndConnection}
            disabled={!isCallActive}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            接続終了
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">自分の映像</h2>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto bg-gray-900 rounded-lg"
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">相手の映像</h2>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-auto bg-gray-900 rounded-lg"
            />
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">使い方</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>2つのブラウザウィンドウ（通常 + シークレットなど）でこのページを開く</li>
            <li>両方のウィンドウで「接続開始」ボタンをクリック</li>
            <li>お互いのカメラ映像が表示されれば成功です</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

