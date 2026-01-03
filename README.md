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

### AI & Voice
- **Claude AI** - Conversation & correction
- **VibeVoice** - Text-to-Speech (Microsoft open source)
- **OpenAI Whisper** - Speech-to-Text (local)

### Data
- **SQLite** - Learning history, topics, corrections
- **File System** - Audio recordings

## Project Structure

```
fluentloop/
├── src/
│   ├── renderer/           # React app
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # AI, TTS, STT services
│   │   └── store/          # State management
│   └── main/               # Electron main process
├── python-backend/         # VibeVoice + Whisper server
└── data/                   # SQLite DB & recordings
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- GPU recommended for Whisper

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fluentloop.git
cd fluentloop

# Install dependencies
npm install

# Install Python dependencies
cd python-backend
pip install -r requirements.txt

# Build TypeScript and run the app
npm start
```

## License

MIT
