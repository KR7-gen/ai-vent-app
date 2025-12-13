import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // 接続されているクライアントのリストを管理
  const connectedClients = new Set<string>();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    connectedClients.add(socket.id);

    // join イベント: クライアントが参加
    socket.on('join', () => {
      console.log('Client joined:', socket.id);
      const clients = Array.from(connectedClients);
      
      // 既存のクライアントに新しいクライアントの参加を通知
      socket.broadcast.emit('user-joined', { socketId: socket.id });
      
      // 新しいクライアントに既存のクライアント情報を送信
      if (clients.length > 1) {
        // 既存のクライアントがいる場合、最初のクライアントにoffer作成を促す
        const otherClients = clients.filter(id => id !== socket.id);
        socket.emit('existing-users', { users: otherClients });
        
        // 最初のクライアントにoffer作成を促す
        if (otherClients.length > 0) {
          io.to(otherClients[0]).emit('create-offer', { targetSocketId: socket.id });
        }
      }
    });

    // webrtc-offer イベント: offer を特定のクライアントまたは全員に送信
    socket.on('webrtc-offer', (data: { offer: RTCSessionDescriptionInit; socketId: string; targetSocketId?: string }) => {
      console.log('Offer received from:', data.socketId, 'target:', data.targetSocketId);
      if (data.targetSocketId) {
        // 特定のクライアントに送信
        io.to(data.targetSocketId).emit('webrtc-offer', {
          offer: data.offer,
          socketId: data.socketId,
        });
      } else {
        // 全員にブロードキャスト（後方互換性）
        socket.broadcast.emit('webrtc-offer', {
          offer: data.offer,
          socketId: data.socketId,
        });
      }
    });

    // webrtc-answer イベント: answer を特定のクライアントまたは全員に送信
    socket.on('webrtc-answer', (data: { answer: RTCSessionDescriptionInit; socketId: string; targetSocketId?: string }) => {
      console.log('Answer received from:', data.socketId, 'target:', data.targetSocketId);
      if (data.targetSocketId) {
        // 特定のクライアントに送信
        io.to(data.targetSocketId).emit('webrtc-answer', {
          answer: data.answer,
          socketId: data.socketId,
        });
      } else {
        // 全員にブロードキャスト（後方互換性）
        socket.broadcast.emit('webrtc-answer', {
          answer: data.answer,
          socketId: data.socketId,
        });
      }
    });

    // ice-candidate イベント: ICE candidate を特定のクライアントまたは全員に送信
    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit; socketId: string; targetSocketId?: string }) => {
      if (data.targetSocketId) {
        // 特定のクライアントに送信
        io.to(data.targetSocketId).emit('ice-candidate', {
          candidate: data.candidate,
          socketId: data.socketId,
        });
      } else {
        // 全員にブロードキャスト（後方互換性）
        socket.broadcast.emit('ice-candidate', {
          candidate: data.candidate,
          socketId: data.socketId,
        });
      }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      connectedClients.delete(socket.id);
      socket.broadcast.emit('user-left', { socketId: socket.id });
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

