# FluentLoop

6단계 영어 학습 방법론을 기반으로 한 AI 기반 데스크톱 영어 학습 앱

## Features

- **6-Step Learning Process**: 체계적인 학습 단계로 영어 실력 향상
- **AI-Powered Conversation**: Claude AI와 실시간 롤플레이 대화
- **Smart Correction**: AI가 문법, 어휘, 자연스러움을 한 문장씩 첨삭
- **TTS/STT Integration**: 음성 합성 및 음성 인식으로 스피킹 연습
- **Progress Tracking**: 학습 기록 저장 및 성장 추적

## Learning Steps

| Step | Description |
|------|-------------|
| 1 | 토픽 선택 - 한국어로 말하면 AI가 CEFR 레벨에 맞게 영어로 변환 |
| 2 | 리스닝 & 음독 - TTS로 듣고 따라 말하며 녹음 |
| 3 | 3/2/1분 리텔링 - 키워드만 보고 제한 시간 내 리텔링 |
| 4 | 리텔링 첨삭 - AI가 한 문장씩 수정 |
| 5 | AI 롤플레잉 - 5분간 토픽 관련 영어 대화 |
| 6 | 롤플레잉 첨삭 - 대화 내용 전체 첨삭 |

## Tech Stack

### Frontend
- **Electron** - Cross-platform desktop app
- **React** - UI framework
- **TypeScript** - Type safety

### Backend
- **FastAPI** - Python 기반 REST API 서버

### AI & Voice
- **Claude AI** - Conversation & correction
- **TTS**: Edge-TTS (Microsoft) 또는 Supertonic (선택 가능)
- **STT**: faster-whisper (최적화된 Whisper 구현)

### Data
- **SQLite** - Learning history, topics, corrections
- **File System** - Audio recordings

## Project Structure

```
fluentloop/
├── src/
│   ├── config/              # 환경 설정
│   ├── main/                # Electron main process
│   │   ├── database/        # SQLite 관련
│   │   ├── services/        # AI, TTS, STT 서비스
│   │   └── ipc/             # IPC 핸들러 (6단계별)
│   └── renderer/            # React frontend
│       ├── components/
│       ├── pages/           # 6단계 학습 페이지
│       ├── hooks/
│       └── styles/
├── python-backend/          # FastAPI 서버
├── scripts/                 # 빌드 스크립트
└── data/                    # SQLite DB & 녹음 파일
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- (선택) NVIDIA GPU - STT 가속용

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fluentloop.git
cd fluentloop

# Install Node.js dependencies
npm install

# Install Python dependencies
cd python-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### Environment Configuration

프로젝트 루트와 python-backend 폴더에 각각 `.env` 파일을 생성해야 합니다.

**루트 `.env` 파일** (`.env.example` 참고):
```env
# Python Backend Configuration
BACKEND_URL=http://localhost:8000

# Application Environment (development or production)
NODE_ENV=development
```

> **⚠️ 필수: Claude Code 설치 및 인증**
>
> 이 앱은 AI 기능을 위해 **Claude Code SDK**를 사용합니다. 앱 실행 전 반드시 다음 단계를 완료해야 합니다:
>
> 1. [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 설치
> 2. 터미널에서 `claude` 명령어 실행 후 사용자 인증 완료
>
> 인증이 완료되지 않으면 AI 대화 및 첨삭 기능이 작동하지 않습니다.

**`python-backend/.env` 파일** (`python-backend/.env.example` 참고):
```env
# TTS Engine Selection: edge-tts or supertonic(default)
TTS_PROVIDER=supertonic

# Supertonic TTS Configuration
SUPERTONIC_VOICE=M4

# Edge TTS Configuration (used when TTS_PROVIDER=edge-tts)
EDGE_TTS_VOICE=en-US-AriaNeural

# Whisper STT Configuration
WHISPER_MODEL=small
STT_USE_GPU=false  # NVIDIA GPU 사용시 true

# Server Configuration
PORT=8000  # If changed, update BACKEND_URL in root .env accordingly
LOG_LEVEL=info
```

### Running the App

**개발 모드 (권장):**
```bash
npm run dev  # Electron + Python 서버 동시 실행
```

**개별 실행:**
```bash
# 터미널 1: Python 백엔드
npm run dev:python

# 터미널 2: Electron 앱
npm run dev:electron
```

### Packaging

프로덕션 빌드를 생성하려면:
```bash
npm run package
```

## License

GPL-3.0-or-later
