import Database from 'better-sqlite3';
import { Topic, CreateTopicDTO, UpdateTopicDTO, TopicStatus } from '../models';
import { AppError, ErrorCode } from '../../errors/AppError';

export interface ITopicRepository {
  create(topic: CreateTopicDTO): Promise<number>;
  findById(id: number): Promise<Topic | null>;
  findAll(): Promise<Topic[]>;
  update(id: number, data: UpdateTopicDTO): Promise<void>;
  setActive(id: number): Promise<void>;
  getActiveTopic(): Promise<Topic | null>;
  deactivateAll(): Promise<void>;
}

export class TopicRepository implements ITopicRepository {
  constructor(private db: Database.Database) {}

  async create(topic: CreateTopicDTO): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO topics (
          title, korean_content, english_content, cefr_level,
          keywords, recording_path, week_start_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        topic.title,
        topic.koreanContent,
        topic.englishContent,
        topic.cefrLevel,
        JSON.stringify(topic.keywords),
        topic.recordingPath,
        topic.weekStartDate?.toISOString() || null
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to create topic',
        '토픽 생성에 실패했습니다.',
        error as Error
      );
    }
  }

  async findById(id: number): Promise<Topic | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM topics WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.mapRowToTopic(row);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to find topic',
        '토픽 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  async findAll(): Promise<Topic[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM topics ORDER BY created_at DESC');
      const rows = stmt.all() as any[];

      return rows.map((row) => this.mapRowToTopic(row));
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to find all topics',
        '토픽 목록 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  async update(id: number, data: UpdateTopicDTO): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        values.push(data.title);
      }
      if (data.englishContent !== undefined) {
        updates.push('english_content = ?');
        values.push(data.englishContent);
      }
      if (data.cefrLevel !== undefined) {
        updates.push('cefr_level = ?');
        values.push(data.cefrLevel);
      }
      if (data.keywords !== undefined) {
        updates.push('keywords = ?');
        values.push(JSON.stringify(data.keywords));
      }
      if (data.status !== undefined) {
        updates.push('status = ?');
        values.push(data.status);
      }

      if (updates.length === 0) {
        return;
      }

      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE topics SET ${updates.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to update topic',
        '토픽 업데이트에 실패했습니다.',
        error as Error
      );
    }
  }

  async setActive(id: number): Promise<void> {
    try {
      // 트랜잭션 시작
      const deactivateStmt = this.db.prepare('UPDATE topics SET status = ? WHERE status = ?');
      const activateStmt = this.db.prepare(`
        UPDATE topics
        SET status = ?, week_start_date = ?
        WHERE id = ?
      `);

      const transaction = this.db.transaction(() => {
        deactivateStmt.run('inactive', 'active');
        activateStmt.run('active', new Date().toISOString(), id);
      });

      transaction();
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to set active topic',
        '토픽 활성화에 실패했습니다.',
        error as Error
      );
    }
  }

  async getActiveTopic(): Promise<Topic | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM topics WHERE status = ? LIMIT 1');
      const row = stmt.get('active') as any;

      if (!row) {
        return null;
      }

      return this.mapRowToTopic(row);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to get active topic',
        '활성 토픽 조회에 실패했습니다.',
        error as Error
      );
    }
  }

  async deactivateAll(): Promise<void> {
    try {
      const stmt = this.db.prepare('UPDATE topics SET status = ? WHERE status = ?');
      stmt.run('inactive', 'active');
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_QUERY_ERROR,
        'Failed to deactivate all topics',
        '토픽 비활성화에 실패했습니다.',
        error as Error
      );
    }
  }

  private mapRowToTopic(row: any): Topic {
    return {
      id: row.id,
      title: row.title,
      koreanContent: row.korean_content,
      englishContent: row.english_content,
      cefrLevel: row.cefr_level,
      keywords: JSON.parse(row.keywords || '[]'),
      recordingPath: row.recording_path,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as TopicStatus,
      weekStartDate: row.week_start_date ? new Date(row.week_start_date) : null,
    };
  }
}
