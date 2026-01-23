/**
 * Environment Configuration Module
 *
 * 환경변수 기반 설정 관리
 * - .env 파일 로딩
 * - 환경변수 검증 및 기본값 fallback
 * - TypeScript 타입 안전성 제공
 */

import { app } from 'electron';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * .env 파일 경로 결정
 * - 테스트: DOTENV_CONFIG_PATH 환경변수 사용
 * - 패키징된 앱: resources/.env (extraResources로 복사된 위치)
 * - 개발 모드: 프로젝트 루트/.env
 */
function getEnvPath(): string {
  // 테스트 환경에서 override 가능
  if (process.env.DOTENV_CONFIG_PATH) {
    return process.env.DOTENV_CONFIG_PATH;
  }

  // 패키징된 앱인지 확인 (app.isPackaged 사용)
  try {
    if (app.isPackaged) {
      // 패키징된 앱: process.resourcesPath = resources/ 디렉토리
      return path.join(process.resourcesPath, '.env');
    }
  } catch {
    // app이 아직 ready가 아니거나 main process가 아닌 경우
  }

  // 개발 모드: 프로젝트 루트
  return path.resolve(__dirname, '../../.env');
}

const envPath = getEnvPath();

// .env 파일 로딩
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`[EnvConfig] .env file not found at: ${envPath}`);
}

/**
 * 애플리케이션 설정 타입
 */
export interface AppConfig {
  /** Python 백엔드 전체 URL */
  readonly backendUrl: string;

  /** 실행 환경 */
  readonly environment: 'development' | 'production';
}

/**
 * URL 유효성 검사
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 환경변수에서 백엔드 URL 가져오기 (검증 포함)
 */
function getBackendUrl(): string {
  const envUrl = process.env.BACKEND_URL?.trim();
  const defaultUrl = 'http://localhost:8000';

  // 환경변수가 없으면 기본값 사용
  if (!envUrl) {
    return defaultUrl;
  }

  // URL 형식 검증
  if (!isValidUrl(envUrl)) {
    console.error(`[EnvConfig] Invalid BACKEND_URL: ${envUrl}. Using default.`);
    return defaultUrl;
  }

  return envUrl;
}

/**
 * 환경변수에서 환경 타입 가져오기
 */
function getEnvironment(): 'development' | 'production' {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    return 'production';
  }

  return 'development';
}

/**
 * 설정을 동적으로 생성하는 함수
 * 테스트 환경에서 환경변수 변경을 지원하기 위해 함수로 래핑
 */
function createConfig(): AppConfig {
  return {
    backendUrl: getBackendUrl(),
    environment: getEnvironment(),
  };
}

/**
 * 중앙 집중식 설정 객체
 *
 * 우선순위:
 * 1. 시스템 환경변수 (process.env)
 * 2. .env 파일 값
 * 3. 기본값
 */
export const config: AppConfig = createConfig();
