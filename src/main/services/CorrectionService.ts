import Database from 'better-sqlite3';
import { ClaudeService } from './ClaudeService';
import { CorrectionResult, Correction, CEFRLevel } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

export class CorrectionService {
  private db: Database.Database;
  private claudeService: ClaudeService;

  constructor(db?: Database.Database) {
    // Allow dependency injection for testing
    if (db) {
      this.db = db;
    } else {
      // In production, get database from db module (lazy load to avoid circular dependency in tests)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDatabase } = require('../database/db');
      this.db = getDatabase();
    }
    this.claudeService = new ClaudeService();
  }

  /**
   * TC-005, TC-006, TC-007: 텍스트를 문장 단위로 분리
   *
   * 마침표, 느낌표, 물음표 기준으로 분리하되,
   * 약어(Mr., Mrs., Dr., U.S.A. 등)는 예외 처리
   */
  splitSentences(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 약어 목록 (확장 가능)
    const abbreviations = [
      'Mr',
      'Mrs',
      'Ms',
      'Dr',
      'Prof',
      'Sr',
      'Jr',
      'U.S.A',
      'U.S',
      'U.K',
      'Ph.D',
      'M.D',
      'B.A',
      'M.A',
      'etc',
      'i.e',
      'e.g',
      'vs',
      'Inc',
      'Ltd',
      'Co',
    ];

    // 약어를 임시 플레이스홀더로 치환
    let processed = text;
    const placeholders: Map<string, string> = new Map();

    abbreviations.forEach((abbr, index) => {
      const patterns = [
        new RegExp(`\\b${abbr}\\.`, 'gi'),
        new RegExp(`\\b${abbr.replace(/\./g, '\\.')}`, 'gi'),
      ];

      patterns.forEach((pattern) => {
        processed = processed.replace(pattern, (match) => {
          const placeholder = `__ABBR${index}__`;
          placeholders.set(placeholder, match);
          return placeholder;
        });
      });
    });

    // 문장 분리 (마침표, 느낌표, 물음표 뒤에 공백 또는 문자열 끝)
    const sentenceRegex = /[.!?]+(?:\s+|$)/g;
    const parts = processed.split(sentenceRegex);

    // 구두점을 다시 붙임
    const sentences: string[] = [];
    let remaining = processed;

    parts.forEach((part, index) => {
      if (!part.trim()) return;

      const match = remaining.match(sentenceRegex);
      if (match) {
        const punctuation = match[0].trim();
        sentences.push(part.trim() + punctuation);
        remaining = remaining.substring(remaining.indexOf(part) + part.length + match[0].length);
      } else if (index === parts.length - 1 && part.trim()) {
        // 마지막 부분 (구두점 없을 수 있음)
        sentences.push(part.trim());
      }
    });

    // 플레이스홀더를 원래 약어로 복원
    const restored = sentences
      .map((sentence) => {
        let result = sentence;
        placeholders.forEach((original, placeholder) => {
          result = result.replace(new RegExp(placeholder, 'g'), original);
        });
        return result.trim();
      })
      .filter((s) => s.length > 1); // 빈 문장 제거

    return restored;
  }

  /**
   * TC-001~004: 단일 문장 첨삭
   */
  async correctSentence(
    sentence: string,
    cefrLevel: CEFRLevel,
    retries: number = 2
  ): Promise<CorrectionResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.claudeService.correctSentence(sentence, cefrLevel);
        return result;
      } catch (error) {
        lastError = error as Error;

        // 재시도 가능한 에러인지 확인
        if (error instanceof AppError && error.code === ErrorCode.CLAUDE_TIMEOUT) {
          console.log(`Retry attempt ${attempt + 1}/${retries}...`);
          await this.delay(1000 * (attempt + 1)); // Exponential backoff
          continue;
        }

        // 재시도 불가능한 에러는 즉시 throw
        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * 여러 문장 배치 첨삭 (순차 처리)
   */
  async correctMultipleSentences(
    sentences: string[],
    cefrLevel: CEFRLevel,
    onProgress?: (index: number) => void
  ): Promise<CorrectionResult[]> {
    const results: CorrectionResult[] = [];

    for (let i = 0; i < sentences.length; i++) {
      if (onProgress) {
        onProgress(i);
      }

      const result = await this.correctSentence(sentences[i], cefrLevel);
      results.push(result);
    }

    return results;
  }

  /**
   * TC-008, TC-009: 첨삭 결과 DB 저장
   */
  async saveCorrections(
    corrections: CorrectionResult[],
    sessionId: number,
    topicId: number
  ): Promise<void> {
    if (corrections.length === 0) {
      return; // Nothing to save
    }

    const insertStmt = this.db.prepare(`
      INSERT INTO corrections (
        session_id,
        topic_id,
        original_sentence,
        corrected_sentence,
        explanation,
        categories
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((corrections: CorrectionResult[]) => {
      for (const correction of corrections) {
        insertStmt.run(
          sessionId,
          topicId,
          correction.original,
          correction.corrected,
          correction.explanation,
          JSON.stringify(correction.categories)
        );
      }
    });

    try {
      insertMany(corrections);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'Failed to save corrections',
        '첨삭 결과 저장에 실패했습니다.',
        error as Error
      );
    }
  }

  /**
   * TC-015: 첨삭 히스토리 조회
   */
  getCorrectionsHistory(topicId?: number, sessionId?: number, limit: number = 50): Correction[] {
    let query = 'SELECT * FROM corrections WHERE 1=1';
    const params: any[] = [];

    if (topicId !== undefined) {
      query += ' AND topic_id = ?';
      params.push(topicId);
    }

    if (sessionId !== undefined) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      topicId: row.topic_id,
      originalSentence: row.original_sentence,
      correctedSentence: row.corrected_sentence,
      explanation: row.explanation,
      categories: JSON.parse(row.categories),
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Utility: 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
