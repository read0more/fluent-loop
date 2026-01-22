/**
 * Environment Configuration Module
 *
 * 환경변수 기반 설정 관리
 * - .env 파일 로딩
 * - 환경변수 검증 및 기본값 fallback
 * - TypeScript 타입 안전성 제공
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// .env 파일 경로 (프로젝트 루트, 테스트 시에는 DOTENV_CONFIG_PATH로 override 가능)
const envPath = process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../../.env');

// .env 파일 로딩
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('[EnvConfig] .env file loaded from:', envPath);
} else {
  console.warn('[EnvConfig] .env file not found. Using default values.');
}

/**
 * 애플리케이션 설정 타입
 */
export interface AppConfig {
  /** Python 백엔드 전체 URL */
  readonly backendUrl: string;

  /** 백엔드 포트 번호 */
  readonly backendPort: string;

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
 * 포트 번호 유효성 검사
 */
function isValidPort(port: string): boolean {
  const portNum = parseInt(port, 10);
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
}

/**
 * 환경변수에서 백엔드 URL 가져오기 (검증 포함)
 */
function getBackendUrl(): string {
  const envUrl = process.env.BACKEND_URL?.trim();

  // 환경변수가 없으면 기본값 사용
  if (!envUrl) {
    console.log('[EnvConfig] BACKEND_URL not set. Using default: http://localhost:8000');
    return 'http://localhost:8000';
  }

  // URL 형식 검증
  if (!isValidUrl(envUrl)) {
    console.error(`[EnvConfig] Invalid BACKEND_URL: ${envUrl}. Falling back to default.`);
    return 'http://localhost:8000';
  }

  return envUrl;
}

/**
 * 환경변수에서 백엔드 포트 가져오기 (검증 포함)
 */
function getBackendPort(): string {
  const envPort = process.env.BACKEND_PORT?.trim();

  // 환경변수가 없으면 기본값 사용
  if (!envPort) {
    return '8000';
  }

  // 포트 번호 검증
  if (!isValidPort(envPort)) {
    console.warn(`[EnvConfig] Invalid port: ${envPort}. Using default: 8000`);
    return '8000';
  }

  return envPort;
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
    backendPort: getBackendPort(),
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

// 설정 로딩 완료 로그
console.log('[EnvConfig] Configuration loaded:', {
  backendUrl: config.backendUrl,
  backendPort: config.backendPort,
  environment: config.environment,
});
