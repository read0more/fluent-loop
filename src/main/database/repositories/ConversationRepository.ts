import Database from 'better-sqlite3';
import { Conversation, CreateConversationDTO } from '../models';
import { AppError, ErrorCode } from '../../errors/AppError';

export interface IConversationRepository {
  create(dto: CreateConversationDTO): number;
  findById(id: number): Conversation | null;
  update(id: number, updates: Partial<Conversation>): void;
  delete(id: number): void;
  findByTopicId(topicId: number): Conversation[];
}

export class ConversationRepository implements IConversationRepository {
  constructor(private db: Database.Database) {}

  create(dto: CreateConversationDTO): number {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO conversations (topic_id, session_id, started_at)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        dto.topicId,
        dto.sessionId || null,
        dto.startedAt.toISOString()
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to create conversation',
        '대화 세션 생성에 실패했습니다.',
        error as Error
      );
    }
  }

  findById(id: number): Conversation | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.mapRowToConversation(row);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to find conversation',
        '대화 세션 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  update(id: number, updates: Partial<Conversation>): void {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.endedAt !== undefined) {
        fields.push('ended_at = ?');
        values.push(updates.endedAt ? updates.endedAt.toISOString() : null);
      }

      if (updates.duration !== undefined) {
        fields.push('duration = ?');
        values.push(updates.duration);
      }

      if (updates.messageCount !== undefined) {
        fields.push('message_count = ?');
        values.push(updates.messageCount);
      }

      if (fields.length === 0) {
        return;
      }

      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE conversations SET ${fields.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to update conversation',
        '대화 세션 업데이트에 실패했습니다.',
        error as Error
      );
    }
  }

  delete(id: number): void {
    try {
      const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
      stmt.run(id);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to delete conversation',
        '대화 세션 삭제에 실패했습니다.',
        error as Error
      );
    }
  }

  findByTopicId(topicId: number): Conversation[] {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM conversations WHERE topic_id = ? ORDER BY started_at DESC'
      );
      const rows = stmt.all(topicId) as any[];

      return rows.map((row) => this.mapRowToConversation(row));
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to find conversations by topic',
        '토픽의 대화 세션 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      topicId: row.topic_id,
      sessionId: row.session_id,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      duration: row.duration,
      messageCount: row.message_count,
      createdAt: new Date(row.created_at),
    };
  }
}
