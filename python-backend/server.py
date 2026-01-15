from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn
import os
import tempfile
from datetime import datetime
from stt import WhisperSTT
from tts import TTSProviderFactory, ITTSProvider

# 환경 변수 로딩 (앱 시작 전)
load_dotenv()

# FastAPI 앱 생성
app = FastAPI(
    title="English Learning App - STT & TTS Service",
    description="Whisper STT and Edge TTS service for English learning app",
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

# 서비스 인스턴스 (앱 시작 시 로드)
whisper_stt: WhisperSTT | None = None
tts_provider: ITTSProvider | None = None

# TTS 요청 모델
class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 Whisper 모델 및 TTS 서비스 로드"""
    global whisper_stt, tts_provider

    # Whisper STT 초기화
    model_size = os.getenv("WHISPER_MODEL", "base")
    use_gpu = os.getenv("USE_GPU", "false").lower() == "true"

    print(f"Initializing Whisper STT (model: {model_size}, gpu: {use_gpu})...")
    whisper_stt = WhisperSTT(model_size=model_size, use_gpu=use_gpu)
    print("Whisper STT initialized successfully")

    # TTS Provider 초기화 (Factory 패턴)
    try:
        print("Initializing TTS Provider...")
        tts_provider = TTSProviderFactory.create_provider()
        provider_info = tts_provider.get_provider_info()
        print(f"TTS Provider initialized: {provider_info}")
    except ValueError as e:
        print(f"[ERROR] Failed to initialize TTS provider: {e}")
        print("[WARN] TTS service is disabled. STT (Whisper) is still available.")
        # TTS 없이 서버는 계속 동작 (Whisper만 사용 가능)
    except Exception as e:
        print(f"[ERROR] Unexpected error during TTS initialization: {e}")
        print("[WARN] TTS service is disabled.")

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

    health_data = {
        "status": "ok",
        "whisper_loaded": True,
        "whisper_model": model_info["model_size"],
        "device": model_info["device"],
        "gpu_available": model_info["gpu_available"],
        "tts_loaded": tts_provider is not None,
        "timestamp": datetime.now().isoformat()
    }

    # TTS 프로바이더 정보 추가
    if tts_provider:
        provider_info = tts_provider.get_provider_info()
        health_data["tts_provider"] = provider_info["provider"]
        health_data["tts_voice"] = provider_info["default_voice"]

    return health_data

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


# ==================== TTS 엔드포인트 ====================

@app.post("/tts/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    텍스트를 음성으로 변환

    Args:
        request.text: 변환할 텍스트
        request.voice_id: 사용할 음성 ID (선택사항)

    Returns:
        {
            "success": bool,
            "file_path": str,
            "duration": float,
            "voice_id": str,
            "provider": str
        }
    """
    if tts_provider is None:
        raise HTTPException(
            status_code=503,
            detail="TTS provider not initialized"
        )

    # 텍스트 검증
    if not request.text or not request.text.strip():
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Empty text provided",
                "detail": "Text cannot be empty"
            }
        )

    # 텍스트 길이 제한 (10,000자)
    if len(request.text) > 10000:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Text too long",
                "detail": "Maximum text length is 10,000 characters"
            }
        )

    try:
        # 임시 파일 경로 생성
        temp_dir = tempfile.gettempdir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(temp_dir, f"tts_{timestamp}.mp3")

        # TTS 생성 (프로바이더 추상화)
        result = await tts_provider.synthesize_async(
            request.text,
            output_path,
            request.voice_id
        )

        if not result["success"]:
            # 에러 응답 (기존과 동일)
            return JSONResponse(
                status_code=400 if "voice" in result.get("error", "").lower() else 500,
                content=result
            )

        return result

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "TTS synthesis failed",
                "detail": str(e)
            }
        )


@app.get("/tts/voices")
async def get_available_voices():
    """
    사용 가능한 음성 목록 조회

    Returns:
        {
            "voices": [
                {
                    "id": str,
                    "name": str,
                    "language": str,
                    "gender": str
                }
            ]
        }
    """
    if tts_provider is None:
        raise HTTPException(
            status_code=503,
            detail="TTS provider not initialized"
        )

    try:
        voices = await tts_provider.get_available_voices_async()

        return {
            "voices": voices
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to get voices",
                "detail": str(e)
            }
        )


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
