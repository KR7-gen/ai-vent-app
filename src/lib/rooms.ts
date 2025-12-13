// アクティブなルームIDを管理するモジュール
// server.tsとNext.jsのAPIルートの両方からアクセス可能
// グローバル変数として管理することで、ホットリロード時も状態を保持

declare global {
  // eslint-disable-next-line no-var
  var __activeRooms: Set<string> | undefined;
}

export const activeRooms = 
  globalThis.__activeRooms ?? (globalThis.__activeRooms = new Set<string>());

