from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
from datetime import datetime
from stt import WhisperSTT

# FastAPI 앱 생성
app = FastAPI(
    title="English Learning App - STT Service",
    description="Whisper-based Speech-to-Text service for English learning app",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Whisper STT 인스턴스 (앱 시작 시 로드)
whisper_stt: WhisperSTT | None = None

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 Whisper 모델 로드"""
    global whisper_stt

    # 환경 변수에서 설정 읽기
    model_size = os.getenv("WHISPER_MODEL", "base")
    use_gpu = os.getenv("USE_GPU", "false").lower() == "true"

    print(f"Initializing Whisper STT (model: {model_size}, gpu: {use_gpu})...")
    whisper_stt = WhisperSTT(model_size=model_size, use_gpu=use_gpu)
    print("Whisper STT initialized successfully")

@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    if whisper_stt is None:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": "Whisper model not loaded",
                "timestamp": datetime.now().isoformat()
            }
        )

    model_info = whisper_stt.get_model_info()

    return {
        "status": "ok",
        "whisper_loaded": True,
        "whisper_model": model_info["model_size"],
        "device": model_info["device"],
        "gpu_available": model_info["gpu_available"],
        "timestamp": datetime.now().isoformat()
    }

@app.post("/stt/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("ko")
):
    """
    오디오 파일을 텍스트로 변환

    Args:
        audio: 오디오 파일 (multipart/form-data)
        language: 언어 코드 (기본값: ko)

    Returns:
        {
            "success": bool,
            "text": str,
            "language": str,
            "duration": float
        }
    """
    if whisper_stt is None:
        raise HTTPException(
            status_code=503,
            detail="Whisper model not loaded"
        )

    # 파일 형식 검증
    allowed_extensions = [".m4a", ".mp3", ".wav", ".ogg", ".flac"]
    file_ext = os.path.splitext(audio.filename or "")[1].lower()

    if file_ext not in allowed_extensions:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Unsupported audio format",
                "detail": f"Allowed formats: {', '.join(allowed_extensions)}"
            }
        )

    # 임시 파일에 저장
    temp_file = None
    try:
        # 임시 파일 생성
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # STT 실행
        result = whisper_stt.transcribe(temp_path, language=language)

        # 빈 텍스트 확인
        if not result["text"]:
            return {
                "success": False,
                "error": "No speech detected",
                "text": "",
                "language": language,
                "duration": result.get("duration", 0.0)
            }

        return {
            "success": True,
            "text": result["text"],
            "language": result["language"],
            "duration": result.get("duration", 0.0)
        }

    except FileNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": "Audio file not found",
                "detail": str(e)
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "STT processing failed",
                "detail": str(e)
            }
        )

    finally:
        # 임시 파일 정리
        if temp_file and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass

if __name__ == "__main__":
    # 서버 실행
    port = int(os.getenv("PORT", 8000))
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level=log_level
    )
