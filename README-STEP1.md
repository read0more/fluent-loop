# 단계 1: 토픽 선택 기능 - 구현 완료

## 개요

사용자가 한국어로 관심사를 녹음하면 AI가 CEFR 레벨에 맞는 영어 스크립트로 변환하는 기능이 구현되었습니다.

## 구현된 파일 목록

### Backend Services (Electron Main Process)

1. **src/main/database/**
   - `models.ts` - TypeScript 타입 정의
   - `schema.ts` - SQLite 스키마 정의
   - `db.ts` - 데이터베이스 연결 관리
   - `repositories/TopicRepository.ts` - 토픽 데이터 접근 계층

2. **src/main/services/**
   - `AudioService.ts` - 녹음 파일 관리
   - `STTService.ts` - Python 백엔드 연동 (Whisper STT)
   - `ClaudeService.ts` - Claude CLI 래퍼

3. **src/main/errors/**
   - `AppError.ts` - 에러 처리 클래스

4. **src/main/ipc/**
   - `topicHandlers.ts` - IPC 핸들러 (Renderer ↔ Main 통신)

### Frontend Components (React)

5. **src/renderer/components/**
   - `VoiceRecorder.tsx` - 음성 녹음 컴포넌트
   - `CEFRSelector.tsx` - CEFR 레벨 선택기
   - `TopicPreview.tsx` - 토픽 미리보기
   - `LoadingSpinner.tsx` - 로딩 인디케이터

6. **src/renderer/pages/**
   - `TopicCreationPage.tsx` - 토픽 생성 페이지 (전체 플로우 관리)

### Python Backend

7. **python-backend/**
   - `server.py` - FastAPI 서버
   - `stt.py` - Whisper STT 서비스
   - `requirements.txt` - Python 의존성

### Core Files

8. **src/**
   - `main.ts` - Electron 메인 프로세스 (IPC 핸들러 등록)
   - `preload.ts` - IPC 브릿지

## 아키텍처 원칙

### SOLID 원칙 준수

- **단일 책임 원칙 (SRP)**: 각 서비스 클래스는 하나의 책임만 가짐
- **개방-폐쇄 원칙 (OCP)**: 인터페이스를 통한 확장 가능 구조
- **의존성 역전 원칙 (DIP)**: 추상화(인터페이스)에 의존

### 컴포넌트 분리

```
Renderer (React) → IPC Bridge → Main Process (Electron)
                                  ↓
                      ┌───────────┴───────────┐
                      ↓                       ↓
                Services (Business Logic)  Database
                      ↓
                External APIs
              (Python Backend, Claude CLI)
```

## 설치 및 실행

### 1. 프론트엔드 의존성 설치

```bash
npm install
```

### 2. Python 백엔드 설정

```bash
cd python-backend

# 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

### 3. Python 백엔드 실행

```bash
# python-backend 디렉토리에서
python server.py
```

백엔드가 `http://localhost:8000`에서 실행됩니다.

### 4. Electron 앱 빌드 및 실행

```bash
# 프로젝트 루트에서
npm run build
npm start
```

## 사용 방법

1. **CEFR 레벨 선택**: A1 ~ C2 중 원하는 레벨 선택
2. **녹음 시작**: "녹음 시작" 버튼 클릭
3. **한국어로 말하기**: 관심사에 대해 최대 30초간 녹음
4. **자동 처리**:
   - STT로 한국어 텍스트 변환
   - AI가 영어 스크립트 생성
   - 키워드 자동 추출
5. **미리보기 확인**: 생성된 영어 스크립트 확인
6. **저장**: "저장하고 시작" 버튼으로 토픽 저장

## 데이터베이스

SQLite 데이터베이스가 사용자 데이터 디렉토리에 생성됩니다:
- Windows: `%APPDATA%\fluentloop\data\app.db`
- macOS: `~/Library/Application Support/fluentloop/data/app.db`
- Linux: `~/.config/fluentloop/data/app.db`

녹음 파일은 같은 위치의 `recordings/step1/` 디렉토리에 저장됩니다.

## 환경 변수

### Python Backend (.env)

```bash
WHISPER_MODEL=base  # tiny, base, small, medium, large
USE_GPU=false       # GPU 사용 여부
PORT=8000
LOG_LEVEL=info
```

## 에러 처리

모든 에러는 사용자 친화적 메시지로 변환되어 표시됩니다:

- **마이크 권한 거부**: "마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요."
- **STT 서버 연결 실패**: "STT 서버에 연결할 수 없습니다. 백엔드 서버를 시작해주세요."
- **AI 변환 실패**: "AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요."

## 테스트

테스트 파일들이 `__tests__` 디렉토리에 포함되어 있습니다:

```bash
npm test
```

## 다음 단계

- [x] UI/UX 스타일링 (CSS) ✅ 완료 - `src/renderer/styles.css` 추가
- [x] index.html 파일 작성 ✅ 완료 - React 앱 마운트 구조 완성
- [ ] 통합 테스트 실행
- [ ] Python 백엔드 자동 시작 스크립트
- [ ] 에러 복구 로직 강화

## 기술 스택

- **Frontend**: React, TypeScript
- **Backend**: Electron, Node.js, TypeScript
- **Database**: SQLite (better-sqlite3)
- **STT**: Python, FastAPI, OpenAI Whisper
- **AI**: Claude CLI
- **Build**: TypeScript Compiler

## 라이선스

MIT
