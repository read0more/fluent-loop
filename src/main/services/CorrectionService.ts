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
   * TC-005, TC-006, TC-007, TC-008: 텍스트를 문장 단위로 분리
   *
   * 마침표, 느낌표, 물음표 기준으로 분리하되,
   * 약어(Mr., Mrs., Dr., U.S.A. 등)와 시간 표현(a.m., p.m. 등)은 예외 처리
   *
   * 시간 표현 처리:
   * - 숫자 + a.m./p.m. (예: "3 p.m.", "7 a.m.")
   * - 시:분 형식 (예: "3:30 p.m.", "11:45 a.m.")
   * - 대소문자 변형 (a.m., A.M., am, AM)
   * - 공백 있음/없음 (3 p.m., 3p.m.)
   */
  splitSentences(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 섹션 마커 라인 제거 (예: "----2분 리텔링 시 내용----")
    const lines = text.split('\n');
    const filteredLines = lines.filter((line) => !this.isSectionMarker(line));
    const cleanedText = filteredLines.join('\n');

    if (!cleanedText.trim()) {
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

    // 약어 및 시간 표현을 임시 플레이스홀더로 치환
    let processed = cleanedText;
    const placeholders: Map<string, string> = new Map();
    let placeholderIndex = 0;

    // Step 1: 숫자 + 시간 표현 패턴을 먼저 처리 (예: "3 p.m.", "11:30 a.m.")
    // 패턴 매칭 및 플레이스홀더 치환
    const timePatterns = [
      /\b(\d{1,2}):(\d{2})\s*([ap]\.m\.|[AP]\.M\.)/gi, // 3:30 p.m.
      /\b(\d+)\s*([ap]\.m\.|[AP]\.M\.)/gi, // 3 p.m.
      /\b(\d{1,2}):(\d{2})\s*([AP]M|[ap]m)\b/g, // 3:30 PM
      /\b(\d+)\s*([AP]M|[ap]m)\b/g, // 3 PM
    ];

    timePatterns.forEach((pattern) => {
      processed = processed.replace(pattern, (match) => {
        const placeholder = `__TIME${placeholderIndex}__`;
        placeholders.set(placeholder, match);
        placeholderIndex++;
        return placeholder;
      });
    });

    // Step 2: 일반 약어 처리
    abbreviations.forEach((abbr) => {
      // Escape special characters in abbreviation
      const escapedAbbr = abbr.replace(/\./g, '\\.');

      const patterns = [
        // Match abbreviation with trailing dot (e.g., "Dr." from "Dr")
        new RegExp(`\\b${escapedAbbr}\\.`, 'gi'),
        // Match abbreviation without additional dot (e.g., "U.S" from "U.S")
        new RegExp(`\\b${escapedAbbr}\\b(?!\\.)`, 'gi'),
      ];

      patterns.forEach((pattern) => {
        processed = processed.replace(pattern, (match) => {
          const placeholder = `__ABBR${placeholderIndex}__`;
          placeholders.set(placeholder, match);
          placeholderIndex++;
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
   * 섹션 마커인지 확인 (예: "----2분 리텔링 시 내용----")
   */
  private isSectionMarker(text: string): boolean {
    // "----"로 시작하고 끝나는 패턴
    const sectionMarkerPattern = /^-{2,}.*-{2,}$/;
    return sectionMarkerPattern.test(text.trim());
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
   * 여러 문장 배치 첨삭 (순차 처리) - Legacy
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
   * 여러 문장 배치 첨삭 (한 번의 API 호출) - 성능 최적화
   * N개 문장을 1번의 Claude API 호출로 처리
   */
  async correctSentencesBatch(
    sentences: string[],
    cefrLevel: CEFRLevel,
    retries: number = 2
  ): Promise<CorrectionResult[]> {
    if (!sentences || sentences.length === 0) {
      return [];
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const results = await this.claudeService.correctSentencesBatch(sentences, cefrLevel);
        return results;
      } catch (error) {
        lastError = error as Error;

        // 재시도 가능한 에러인지 확인
        if (error instanceof AppError && error.code === ErrorCode.CLAUDE_TIMEOUT) {
          console.log(`Batch correction retry attempt ${attempt + 1}/${retries}...`);
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
   * TC-008, TC-009: 첨삭 결과 DB 저장
   */
  async saveCorrections(
    corrections: CorrectionResult[],
    sessionId: number | null,
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

    if (sessionId !== undefined && sessionId !== null) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    query += ' ORDER BY id ASC LIMIT ?';
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
   * 특정 토픽의 최신 리텔링 생성 시간 조회
   */
  getLatestRetellingTimestamp(topicId: number): string | null {
    const row = this.db
      .prepare(
        `
      SELECT MAX(created_at) as latest_created_at
      FROM retellings
      WHERE topic_id = ?
    `
      )
      .get(topicId) as { latest_created_at: string | null } | undefined;

    return row?.latest_created_at || null;
  }

  /**
   * 유효한 첨삭 결과만 조회 (리텔링 이후에 생성된 것만)
   * 리텔링 텍스트가 변경되면 이전 첨삭 결과는 무효화됨
   */
  getValidCorrectionsHistory(
    topicId: number,
    sessionId?: number | null,
    limit: number = 50
  ): Correction[] {
    // 1. 최신 리텔링 시간 조회
    const latestRetellingTime = this.getLatestRetellingTimestamp(topicId);

    // 리텔링이 없으면 빈 배열 반환 (첨삭도 무효)
    if (!latestRetellingTime) {
      return [];
    }

    // 2. 리텔링 이후에 생성된 첨삭만 조회
    let query = `
      SELECT * FROM corrections
      WHERE topic_id = ?
        AND created_at > ?
    `;
    const params: any[] = [topicId, latestRetellingTime];

    if (sessionId !== undefined && sessionId !== null) {
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
