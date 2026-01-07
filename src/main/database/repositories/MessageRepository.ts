import Database from 'better-sqlite3';
import { Message, CreateMessageDTO } from '../models';
import { AppError, ErrorCode } from '../../errors/AppError';

export interface IMessageRepository {
  create(dto: CreateMessageDTO): number;
  findById(id: number): Message | null;
  findByConversationId(conversationId: number): Message[];
  countByConversationId(conversationId: number): number;
  delete(id: number): void;
}

export class MessageRepository implements IMessageRepository {
  constructor(private db: Database.Database) {}

  create(dto: CreateMessageDTO): number {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO conversation_messages (conversation_id, speaker, content, audio_path, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        dto.conversationId,
        dto.speaker,
        dto.content,
        dto.audioPath || null,
        dto.timestamp
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to create message',
        '메시지 저장에 실패했습니다.',
        error as Error
      );
    }
  }

  findById(id: number): Message | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM conversation_messages WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.mapRowToMessage(row);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to find message',
        '메시지 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  findByConversationId(conversationId: number): Message[] {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC'
      );
      const rows = stmt.all(conversationId) as any[];

      return rows.map((row) => this.mapRowToMessage(row));
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to find messages',
        '메시지 목록 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  countByConversationId(conversationId: number): number {
    try {
      const stmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM conversation_messages WHERE conversation_id = ?'
      );
      const result = stmt.get(conversationId) as any;

      return result.count;
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to count messages',
        '메시지 개수 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  delete(id: number): void {
    try {
      const stmt = this.db.prepare('DELETE FROM conversation_messages WHERE id = ?');
      stmt.run(id);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to delete message',
        '메시지 삭제에 실패했습니다.',
        error as Error
      );
    }
  }

  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      speaker: row.speaker as 'user' | 'ai',
      content: row.content,
      audioPath: row.audio_path,
      timestamp: row.timestamp,
      createdAt: new Date(row.created_at),
    };
  }
}
