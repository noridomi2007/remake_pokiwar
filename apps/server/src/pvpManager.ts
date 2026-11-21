import {
  applyPetProgression,
  createBattleState,
  executeDefaultCast,
  executeInBattleEvolve,
  executeSkill,
  executeSupportCard,
  executeSwap,
  getAvatarById,
  getPetById,
  MAX_PET_LEVEL,
  passTurn,
  type BattleEvent,
  type BattleState,
  type ChatMessage,
  type EvolutionTier,
  type Pos,
  type QteGrade,
  type Side,
  type SupportCardId,
} from '@pokiwar/shared';
import type { WebSocket } from 'ws';

const TURN_DURATION_MS = 20_000;

export type ClientPacket =
  | {
      type: 'QUICK_MATCH';
      petId: string;
      playerName: string;
      petLevel?: number;
      petTier?: EvolutionTier;
      avatarId?: string;
    }
  | { type: 'CANCEL_QUEUE' }
  | {
      type: 'CREATE_ROOM';
      petId: string;
      playerName: string;
      petLevel?: number;
      petTier?: EvolutionTier;
      avatarId?: string;
    }
  | {
      type: 'JOIN_ROOM';
      roomCode: string;
      petId: string;
      playerName: string;
      petLevel?: number;
      petTier?: EvolutionTier;
      avatarId?: string;
    }
  | { type: 'SWAP'; from: Pos; to: Pos }
  | { type: 'CAST_SKILL'; skillId: string; qteGrade?: QteGrade; selectedRows?: number[] }
  | { type: 'IN_BATTLE_EVOLVE' }
  | { type: 'SUPPORT_CARD'; cardId: SupportCardId }
  | { type: 'DEFAULT_CAST' }
  | { type: 'PASS_TURN' }
  | { type: 'SURRENDER' }
  | { type: 'PING'; ts?: number }
  | { type: 'CHAT_SEND'; channel: 'WORLD' | 'SERVER' | 'GUILD'; sender: string; vip?: number; text: string }
  | { type: 'SERVER_ANNOUNCE'; text: string };

export type ServerPacket =
  | { type: 'QUEUED'; position: number }
  | { type: 'QUEUE_CANCELLED' }
  | { type: 'ROOM_CREATED'; roomCode: string }
  | {
      type: 'MATCH_STARTED';
      roomId: string;
      yourSide: Side;
      opponentName: string;
      state: BattleState;
      turnDeadlineMs: number;
    }
  | {
      type: 'BATTLE_UPDATE';
      events: BattleEvent[];
      state: BattleState;
      turnDeadlineMs: number;
    }
  | { type: 'CHAT_HISTORY'; messages: ChatMessage[] }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'SERVER_ANNOUNCE'; text: string; ts: number }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG'; ts?: number };

interface PlayerConn {
  ws: WebSocket;
  name: string;
  petId: string;
  petLevel: number;
  petTier?: EvolutionTier;
  avatarId?: string;
  roomId?: string;
  side?: Side;
}

interface PvpRoom {
  id: string;
  code?: string;
  p1: PlayerConn;
  p2?: PlayerConn;
  state?: BattleState;
  turnDeadlineMs: number;
  timer?: NodeJS.Timeout;
}

export class PvpManager {
  private connections = new Map<WebSocket, PlayerConn>();
  private queue: PlayerConn[] = [];
  private rooms = new Map<string, PvpRoom>();
  private roomCodes = new Map<string, string>();
  private chatHistory: ChatMessage[] = [
    {
      id: 'sys-welcome-1',
      channel: 'SYSTEM',
      sender: 'Hệ Thống',
      text: 'Chào mừng đến Pokiwar 4.0 Zing Me! Tham gia Đấu Trường Bá Vương 5v5, Hội Quán & Thám Hiểm Vũ Trụ để săn Titan!',
      ts: Date.now(),
    },
  ];
  private chatSeq = 1;

  handleConnect(ws: WebSocket): void {
    this.connections.set(ws, {
      ws,
      name: 'Chiến binh',
      petId: 'pet-583',
      petLevel: 1,
    });
    this.send(ws, { type: 'CHAT_HISTORY', messages: this.chatHistory.slice(-30) });
  }

  handleDisconnect(ws: WebSocket): void {
    const conn = this.connections.get(ws);
    if (!conn) return;

    this.removeFromQueue(conn);

    if (conn.roomId) {
      const room = this.rooms.get(conn.roomId);
      if (room) {
        this.clearRoomTimer(room);
        const opponent = room.p1 === conn ? room.p2 : room.p1;
        if (room.state && !room.state.winner && opponent && conn.side) {
          const winner: Side = conn.side === 'P1' ? 'P2' : 'P1';
          room.state.winner = winner;
          this.send(opponent.ws, {
            type: 'BATTLE_UPDATE',
            events: [{ type: 'BATTLE_END', winner, reason: 'DISCONNECT' }],
            state: room.state,
            turnDeadlineMs: 0,
          });
        }
        this.cleanupRoom(room);
      }
    }

    this.connections.delete(ws);
  }

  handleMessage(ws: WebSocket, raw: string): void {
    const conn = this.connections.get(ws);
    if (!conn) return;

    let msg: ClientPacket;
    try {
      msg = JSON.parse(raw) as ClientPacket;
    } catch {
      this.send(ws, { type: 'ERROR', message: 'Gói tin không hợp lệ.' });
      return;
    }

    switch (msg.type) {
      case 'PING':
        this.send(ws, { type: 'PONG', ts: msg.ts });
        return;

      case 'QUICK_MATCH':
        this.handleQuickMatch(conn, msg);
        return;

      case 'CANCEL_QUEUE':
        this.removeFromQueue(conn);
        this.send(ws, { type: 'QUEUE_CANCELLED' });
        return;

      case 'CREATE_ROOM':
        this.handleCreateRoom(conn, msg);
        return;

      case 'JOIN_ROOM':
        this.handleJoinRoom(conn, msg);
        return;

      case 'SWAP':
        this.handleSwap(conn, msg.from, msg.to);
        return;

      case 'CAST_SKILL':
        this.handleCastSkill(conn, msg.skillId, msg.qteGrade, msg.selectedRows);
        return;

      case 'IN_BATTLE_EVOLVE':
        this.handleInBattleEvolve(conn);
        return;

      case 'SUPPORT_CARD':
        this.handleSupportCard(conn, msg.cardId);
        return;

      case 'DEFAULT_CAST':
        this.handleDefaultCast(conn);
        return;

      case 'PASS_TURN':
        this.handlePassTurn(conn);
        return;

      case 'SURRENDER':
        this.handleSurrender(conn);
        return;

      case 'CHAT_SEND': {
        const cleanText = String(msg.text ?? '').trim().slice(0, 140);
        if (!cleanText) return;
        const cleanSender = String(msg.sender ?? conn.name).trim().slice(0, 22) || 'Chiến binh';
        const chatMsg: ChatMessage = {
          id: `chat-${Date.now()}-${this.chatSeq++}`,
          channel: msg.channel === 'SERVER' || msg.channel === 'GUILD' ? msg.channel : 'WORLD',
          sender: cleanSender,
          vip: typeof msg.vip === 'number' ? msg.vip : undefined,
          text: cleanText,
          ts: Date.now(),
        };
        this.chatHistory.push(chatMsg);
        if (this.chatHistory.length > 60) {
          this.chatHistory = this.chatHistory.slice(-60);
        }
        for (const peerWs of this.connections.keys()) {
          this.send(peerWs, { type: 'CHAT_MESSAGE', message: chatMsg });
        }
        return;
      }

      case 'SERVER_ANNOUNCE': {
        const cleanText = String(msg.text ?? '').trim().slice(0, 180);
        if (!cleanText) return;
        const ts = Date.now();
        const sysMsg: ChatMessage = {
          id: `sys-${ts}-${this.chatSeq++}`,
          channel: 'SYSTEM',
          sender: 'Thông Báo',
          text: cleanText,
          ts,
        };
        this.chatHistory.push(sysMsg);
        if (this.chatHistory.length > 60) {
          this.chatHistory = this.chatHistory.slice(-60);
        }
        for (const peerWs of this.connections.keys()) {
          this.send(peerWs, { type: 'SERVER_ANNOUNCE', text: cleanText, ts });
          this.send(peerWs, { type: 'CHAT_MESSAGE', message: sysMsg });
        }
        return;
      }
    }
  }

  getStats() {
    return {
      onlinePlayers: this.connections.size,
      queueSize: this.queue.length,
      activeRooms: this.rooms.size,
    };
  }

  private applyConnMeta(
    conn: PlayerConn,
    meta: { petId: string; playerName: string; petLevel?: number; petTier?: EvolutionTier; avatarId?: string },
  ) {
    conn.petId = meta.petId;
    conn.name = meta.playerName.trim().slice(0, 20) || 'Chiến binh';
    conn.petLevel = Math.max(1, Math.min(MAX_PET_LEVEL, meta.petLevel ?? 1));
    conn.petTier = meta.petTier;
    conn.avatarId = meta.avatarId;
  }

  private handleQuickMatch(
    conn: PlayerConn,
    msg: Extract<ClientPacket, { type: 'QUICK_MATCH' }>,
  ): void {
    if (conn.roomId) {
      this.send(conn.ws, { type: 'ERROR', message: 'Bạn đang ở trong trận đấu.' });
      return;
    }
    this.applyConnMeta(conn, msg);
    this.removeFromQueue(conn);

    const opponent = this.queue.shift();
    if (opponent && opponent !== conn && opponent.ws.readyState === 1) {
      this.startRoom(opponent, conn);
    } else {
      this.queue.push(conn);
      this.send(conn.ws, { type: 'QUEUED', position: this.queue.length });
    }
  }

  private handleCreateRoom(
    conn: PlayerConn,
    msg: Extract<ClientPacket, { type: 'CREATE_ROOM' }>,
  ): void {
    if (conn.roomId) {
      this.send(conn.ws, { type: 'ERROR', message: 'Bạn đang ở trong phòng khác.' });
      return;
    }
    this.removeFromQueue(conn);
    this.applyConnMeta(conn, msg);

    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const code = this.generateRoomCode();
    const room: PvpRoom = { id: roomId, code, p1: conn, turnDeadlineMs: 0 };
    conn.roomId = roomId;
    conn.side = 'P1';

    this.rooms.set(roomId, room);
    this.roomCodes.set(code, roomId);
    this.send(conn.ws, { type: 'ROOM_CREATED', roomCode: code });
  }

  private handleJoinRoom(
    conn: PlayerConn,
    msg: Extract<ClientPacket, { type: 'JOIN_ROOM' }>,
  ): void {
    if (conn.roomId) {
      this.send(conn.ws, { type: 'ERROR', message: 'Bạn đang ở trong phòng khác.' });
      return;
    }
    const cleanCode = msg.roomCode.trim().toUpperCase();
    const roomId = this.roomCodes.get(cleanCode);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room || room.p2) {
      this.send(conn.ws, { type: 'ERROR', message: 'Mã phòng không tồn tại hoặc đã đủ người.' });
      return;
    }

    this.removeFromQueue(conn);
    this.applyConnMeta(conn, msg);
    conn.roomId = room.id;
    conn.side = 'P2';
    room.p2 = conn;
    this.roomCodes.delete(cleanCode);

    this.launchRoomBattle(room);
  }

  private startRoom(p1: PlayerConn, p2: PlayerConn): void {
    const roomId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    p1.roomId = roomId;
    p1.side = 'P1';
    p2.roomId = roomId;
    p2.side = 'P2';
    const room: PvpRoom = { id: roomId, p1, p2, turnDeadlineMs: 0 };
    this.rooms.set(roomId, room);
    this.launchRoomBattle(room);
  }

  private launchRoomBattle(room: PvpRoom): void {
    if (!room.p2) return;
    const p1Pet = applyPetProgression(getPetById(room.p1.petId), room.p1.petLevel, room.p1.petTier);
    const p2Pet = applyPetProgression(getPetById(room.p2.petId), room.p2.petLevel, room.p2.petTier);
    const p1Av = getAvatarById(room.p1.avatarId);
    const p2Av = getAvatarById(room.p2.avatarId);
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const state = createBattleState(p1Pet, p2Pet, seed, 1, room.p1.petLevel, room.p2.petLevel, 8, 8, {
      hpBonus: p1Av.hpBonus,
      atkBonus: p1Av.atkBonus,
      manaBonus: p1Av.manaBonus,
    });
    state.fighters.P2.maxHp += p2Av.hpBonus;
    state.fighters.P2.hp = state.fighters.P2.maxHp;
    state.fighters.P2.attack += p2Av.atkBonus;
    state.fighters.P2.magic += Math.round(p2Av.atkBonus * 0.7);
    state.fighters.P2.maxMana += p2Av.manaBonus;
    room.state = state;
    room.turnDeadlineMs = Date.now() + TURN_DURATION_MS;

    this.send(room.p1.ws, {
      type: 'MATCH_STARTED',
      roomId: room.id,
      yourSide: 'P1',
      opponentName: room.p2.name,
      state,
      turnDeadlineMs: room.turnDeadlineMs,
    });
    this.send(room.p2.ws, {
      type: 'MATCH_STARTED',
      roomId: room.id,
      yourSide: 'P2',
      opponentName: room.p1.name,
      state,
      turnDeadlineMs: room.turnDeadlineMs,
    });

    this.scheduleTurnTimeout(room);
  }

  private handleSwap(conn: PlayerConn, from: Pos, to: Pos): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side) return;

    const result = executeSwap(room.state, conn.side, from, to);
    if (!result.ok) {
      this.send(conn.ws, { type: 'ERROR', message: result.error ?? 'Nước đi không hợp lệ.' });
      return;
    }

    this.broadcastUpdate(room, result.events);
  }

  private handleCastSkill(
    conn: PlayerConn,
    skillId: string,
    qteGrade?: QteGrade,
    selectedRows?: number[],
  ): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side) return;

    const result = executeSkill(room.state, conn.side, skillId, qteGrade, selectedRows);
    if (!result.ok) {
      this.send(conn.ws, { type: 'ERROR', message: result.error ?? 'Không thể dùng kỹ năng.' });
      return;
    }

    this.broadcastUpdate(room, result.events);
  }

  private handleSupportCard(conn: PlayerConn, cardId: SupportCardId): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side) return;

    const result = executeSupportCard(room.state, conn.side, cardId);
    if (!result.ok) {
      this.send(conn.ws, { type: 'ERROR', message: result.error ?? 'Không thể dùng Thẻ Hỗ Trợ.' });
      return;
    }
    const packet: ServerPacket = {
      type: 'BATTLE_UPDATE',
      events: result.events,
      state: room.state,
      turnDeadlineMs: room.turnDeadlineMs,
    };
    this.send(room.p1.ws, packet);
    if (room.p2) this.send(room.p2.ws, packet);
  }

  private handleInBattleEvolve(conn: PlayerConn): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side) return;

    const result = executeInBattleEvolve(room.state, conn.side);
    if (!result.ok) {
      this.send(conn.ws, { type: 'ERROR', message: result.error ?? 'Không thể tiến hóa trong trận.' });
      return;
    }
    const packet: ServerPacket = {
      type: 'BATTLE_UPDATE',
      events: result.events,
      state: room.state,
      turnDeadlineMs: room.turnDeadlineMs,
    };
    this.send(room.p1.ws, packet);
    if (room.p2) this.send(room.p2.ws, packet);
  }

  private handleDefaultCast(conn: PlayerConn): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side) return;

    const result = executeDefaultCast(room.state, conn.side);
    if (!result.ok) {
      this.send(conn.ws, { type: 'ERROR', message: result.error ?? 'Không thể tung Thẻ Chưởng.' });
      return;
    }
    this.broadcastUpdate(room, result.events);
  }

  private handlePassTurn(conn: PlayerConn): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side) return;
    if (room.state.turnNumber <= 1) {
      this.send(conn.ws, { type: 'ERROR', message: 'Không thể bỏ lượt ngay lượt đầu tiên.' });
      return;
    }
    const result = passTurn(room.state, conn.side);
    if (!result.ok) {
      this.send(conn.ws, { type: 'ERROR', message: result.error ?? 'Không thể bỏ lượt.' });
      return;
    }
    this.broadcastUpdate(room, result.events);
  }

  private handleSurrender(conn: PlayerConn): void {
    const room = conn.roomId ? this.rooms.get(conn.roomId) : undefined;
    if (!room || !room.state || !conn.side || room.state.winner) return;

    const winner: Side = conn.side === 'P1' ? 'P2' : 'P1';
    room.state.winner = winner;
    this.broadcastUpdate(room, [{ type: 'BATTLE_END', winner, reason: 'SURRENDER' }]);
  }

  private broadcastUpdate(room: PvpRoom, events: BattleEvent[]): void {
    if (!room.state) return;
    this.clearRoomTimer(room);

    if (room.state.winner) {
      room.turnDeadlineMs = 0;
    } else {
      room.turnDeadlineMs = Date.now() + TURN_DURATION_MS;
      this.scheduleTurnTimeout(room);
    }

    const packet: ServerPacket = {
      type: 'BATTLE_UPDATE',
      events,
      state: room.state,
      turnDeadlineMs: room.turnDeadlineMs,
    };
    this.send(room.p1.ws, packet);
    if (room.p2) {
      this.send(room.p2.ws, packet);
    }

    if (room.state.winner) {
      this.cleanupRoom(room);
    }
  }

  private scheduleTurnTimeout(room: PvpRoom): void {
    this.clearRoomTimer(room);
    room.timer = setTimeout(() => {
      if (!room.state || room.state.winner) return;
      const res = passTurn(room.state, room.state.currentTurn);
      if (res.ok) {
        this.broadcastUpdate(room, res.events);
      }
    }, TURN_DURATION_MS);
  }

  private clearRoomTimer(room: PvpRoom): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = undefined;
    }
  }

  private cleanupRoom(room: PvpRoom): void {
    this.clearRoomTimer(room);
    if (room.code) this.roomCodes.delete(room.code);
    if (room.p1.roomId === room.id) {
      room.p1.roomId = undefined;
      room.p1.side = undefined;
    }
    if (room.p2 && room.p2.roomId === room.id) {
      room.p2.roomId = undefined;
      room.p2.side = undefined;
    }
    this.rooms.delete(room.id);
  }

  private removeFromQueue(conn: PlayerConn): void {
    const idx = this.queue.indexOf(conn);
    if (idx !== -1) this.queue.splice(idx, 1);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.roomCodes.has(code));
    return code;
  }

  private send(ws: WebSocket, packet: ServerPacket): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(packet));
    }
  }
}
