import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { app } from 'electron';

interface CacheMetadata {
  text: string;
  voiceId: string;
  filePath: string;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
}

export interface ITTSCacheService {
  generateCacheKey(text: string, voiceId: string): string;
  getCachedFile(text: string, voiceId: string): string | null;
  saveToCache(text: string, voiceId: string, sourcePath: string): Promise<string>;
  clearCache(): Promise<void>;
  initialize(): Promise<void>;
}

export class TTSCacheService implements ITTSCacheService {
  private readonly cacheDir: string;
  private readonly metadataPath: string;
  private metadata: Map<string, CacheMetadata>;
  private initialized: boolean = false;

  constructor() {
    // userData 경로 기반 캐시 디렉토리 설정
    const userDataPath = app.getPath('userData');
    this.cacheDir = path.join(userDataPath, 'data', 'tts-cache');
    this.metadataPath = path.join(this.cacheDir, 'cache.json');
    this.metadata = new Map();
  }

  /**
   * 캐시 서비스 초기화 (외부에서 호출)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.initializeCache();
    this.initialized = true;
  }

  /**
   * SHA256 해시로 캐시 키 생성
   */
  public generateCacheKey(text: string, voiceId: string): string {
    const data = `${text}||${voiceId}`;
    return crypto.createHash('sha256').update(data, 'utf-8').digest('hex');
  }

  /**
   * 캐시 조회 (동기 메서드)
   */
  public getCachedFile(text: string, voiceId: string): string | null {
    const key = this.generateCacheKey(text, voiceId);
    const cached = this.metadata.get(key);

    if (!cached) {
      return null; // 캐시 미스
    }

    // 파일 존재 여부 검증 (동기)
    try {
      if (!fsSync.existsSync(cached.filePath)) {
        // 파일 손상: 메타데이터 제거
        this.metadata.delete(key);
        this.saveMetadata(); // 비동기로 저장
        return null;
      }
    } catch (error) {
      console.error(`[TTS Cache] File validation error for key ${key}:`, error);
      return null;
    }

    // 접근 정보 업데이트
    this.updateAccessInfo(key);

    console.log(`[TTS Cache HIT] key="${key}" text="${text.substring(0, 30)}..."`);
    return cached.filePath;
  }

  /**
   * 캐시에 파일 저장
   */
  public async saveToCache(text: string, voiceId: string, sourcePath: string): Promise<string> {
    const key = this.generateCacheKey(text, voiceId);
    const ext = path.extname(sourcePath) || '.mp3';
    const cacheFilename = `${key}${ext}`;
    const cachePath = path.join(this.cacheDir, cacheFilename);

    try {
      // 디렉토리 존재 확인 및 생성
      await fs.mkdir(this.cacheDir, { recursive: true });

      // 파일 복사 (원본 유지)
      await fs.copyFile(sourcePath, cachePath);

      // 메타데이터 생성
      const now = new Date().toISOString();
      this.metadata.set(key, {
        text,
        voiceId,
        filePath: cachePath,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
      });

      // 메타데이터 저장
      await this.saveMetadata();

      console.log(`[TTS Cache SAVED] key="${key}" path="${cachePath}"`);
      return cachePath;
    } catch (error) {
      console.error(`[TTS Cache] Failed to save cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * 전체 캐시 삭제
   */
  public async clearCache(): Promise<void> {
    try {
      // 디렉토리 존재 확인
      const exists = await fs
        .access(this.cacheDir)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        // 디렉토리가 없으면 생성만 하고 종료
        await fs.mkdir(this.cacheDir, { recursive: true });
        this.metadata.clear();
        await this.saveMetadata();
        return;
      }

      // 모든 캐시 파일 삭제 (cache.json 제외)
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (file === 'cache.json') continue;

        const filePath = path.join(this.cacheDir, file);
        await fs.unlink(filePath).catch((err) => {
          console.warn(`[TTS Cache] Failed to delete ${file}:`, err);
        });
      }

      // 메타데이터 초기화
      this.metadata.clear();
      await this.saveMetadata();

      console.log('[TTS Cache] All cache cleared');
    } catch (error) {
      console.error('[TTS Cache] Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * 캐시 초기화
   */
  private async initializeCache(): Promise<void> {
    try {
      // 디렉토리 생성
      await fs.mkdir(this.cacheDir, { recursive: true });

      // 메타데이터 로드
      await this.loadMetadata();

      console.log(`[TTS Cache] Initialized at ${this.cacheDir}`);
    } catch (error) {
      console.error('[TTS Cache] Initialization failed:', error);
      this.metadata = new Map(); // 빈 메타데이터로 시작
    }
  }

  /**
   * 메타데이터 로드
   */
  private async loadMetadata(): Promise<void> {
    try {
      const exists = await fs
        .access(this.metadataPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        // 최초 실행 시 빈 메타데이터 저장
        this.metadata = new Map();
        await this.saveMetadata();
        return;
      }

      const data = await fs.readFile(this.metadataPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Object → Map 변환
      this.metadata = new Map(Object.entries(parsed));
    } catch (error) {
      console.error('[TTS Cache] Failed to load metadata:', error);
      this.metadata = new Map();
    }
  }

  /**
   * 메타데이터 저장
   */
  private async saveMetadata(): Promise<void> {
    try {
      // 디렉토리 존재 확인 및 생성
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Map → Object 변환
      const obj = Object.fromEntries(this.metadata);
      const json = JSON.stringify(obj, null, 2);

      await fs.writeFile(this.metadataPath, json, 'utf-8');
    } catch (error) {
      console.error('[TTS Cache] Failed to save metadata:', error);
    }
  }

  /**
   * 접근 정보 업데이트
   */
  private updateAccessInfo(key: string): void {
    const cached = this.metadata.get(key);
    if (!cached) return;

    cached.lastAccessedAt = new Date().toISOString();
    cached.accessCount += 1;

    // 비동기 저장 (블로킹 방지)
    this.saveMetadata().catch((err) => {
      console.warn('[TTS Cache] Failed to update access info:', err);
    });
  }
}
