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
from stt_provider import (
    STTProviderFactory,
    STTProviderType,
    STTResult,
    ISTTProvider
)

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

# STT Provider 인스턴스 (신규 - KAN-21)
stt_whisper_provider: ISTTProvider | None = None
stt_faster_whisper_provider: ISTTProvider | None = None

# TTS 초기화 상태 추적
tts_init_status: str = "pending"  # pending, downloading, ready, error
tts_init_message: str = ""
tts_provider_type: str = os.getenv("TTS_PROVIDER", "supertonic").lower()

# TTS 요청 모델
class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 Whisper 모델 및 TTS 서비스 로드"""
    global whisper_stt, tts_provider, stt_whisper_provider, stt_faster_whisper_provider

    # Whisper STT 초기화 (기존 - 호환성 유지)
    model_size = os.getenv("WHISPER_MODEL", "medium")
    use_gpu = os.getenv("USE_GPU", "false").lower() == "true"

    print(f"Initializing Whisper STT (model: {model_size}, gpu: {use_gpu})...")
    whisper_stt = WhisperSTT(model_size=model_size, use_gpu=use_gpu)
    print("Whisper STT initialized successfully")

    # STT Provider 초기화 (신규 - KAN-21)
    print("Initializing STT Providers...")
    try:
        # Step3용 Whisper Provider (base 모델)
        stt_whisper_provider = STTProviderFactory.create_provider(
            STTProviderType.WHISPER,
            model_size="base"
        )

        # Step5용 faster-whisper Provider (base 모델)
        stt_faster_whisper_provider = STTProviderFactory.create_provider(
            STTProviderType.FASTER_WHISPER,
            model_size="base",
            compute_type="auto"
        )

        print("[Server] All STT Providers initialized")
    except Exception as e:
        print(f"[ERROR] Failed to initialize STT providers: {e}")
        # STT Provider 초기화 실패 시에도 서버는 계속 동작 (기존 whisper_stt 사용 가능)

    # TTS Provider 초기화 (Factory 패턴)
    global tts_init_status, tts_init_message
    try:
        print("Initializing TTS Provider...")

        # Supertonic은 모델 다운로드가 필요할 수 있음
        if tts_provider_type == "supertonic":
            tts_init_status = "downloading"
            tts_init_message = "TTS 모델 다운로드 중... (최초 실행 시 ~260MB)"
            print(f"[TTS] {tts_init_message}")
        else:
            tts_init_status = "downloading"
            tts_init_message = "TTS 서비스 초기화 중..."

        tts_provider = TTSProviderFactory.create_provider()
        provider_info = tts_provider.get_provider_info()

        tts_init_status = "ready"
        tts_init_message = "TTS 서비스 준비 완료"
        print(f"TTS Provider initialized: {provider_info}")
    except ValueError as e:
        tts_init_status = "error"
        tts_init_message = str(e)
        print(f"[ERROR] Failed to initialize TTS provider: {e}")
        print("[WARN] TTS service is disabled. STT (Whisper) is still available.")
        # TTS 없이 서버는 계속 동작 (Whisper만 사용 가능)
    except Exception as e:
        tts_init_status = "error"
        tts_init_message = str(e)
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
        "tts_status": tts_init_status,
        "tts_message": tts_init_message,
        "tts_provider_type": tts_provider_type,
        "tts_requires_download": tts_provider_type == "supertonic",
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


# ==================== STT 신규 엔드포인트 (KAN-21) ====================

@app.post("/stt/stream-chunk")
async def transcribe_audio_chunk(
    audio: UploadFile = File(...),
    language: str = Form("ko"),
    context: str = Form("")  # 이전 청크의 텍스트 (컨텍스트)
) -> STTResult:
    """
    오디오 청크 실시간 STT 변환 (Step5 RolePlay용)

    Args:
        audio: 오디오 청크 파일 (2-3초)
        language: 언어 코드
        context: 이전 청크의 텍스트 (정확도 향상용)

    Returns:
        STTResult: 변환 결과 (is_final=False)
    """
    if stt_faster_whisper_provider is None:
        raise HTTPException(
            status_code=503,
            detail="FasterWhisper Provider not initialized"
        )

    temp_dir = tempfile.gettempdir()
    chunk_path = os.path.join(temp_dir, f"chunk_{os.getpid()}_{os.urandom(4).hex()}.webm")

    try:
        with open(chunk_path, "wb") as f:
            f.write(await audio.read())

        # FasterWhisperSTT Provider 사용
        result = stt_faster_whisper_provider.transcribe_chunk(
            chunk_path,
            language,
            context=context if context else None
        )
        return result

    except Exception as e:
        return STTResult(
            success=False,
            text="",
            language=language,
            error=str(e)
        )

    finally:
        if os.path.exists(chunk_path):
            try:
                os.remove(chunk_path)
            except:
                pass


@app.get("/stt/providers")
async def get_providers_info():
    """현재 로드된 Provider 정보 반환 (디버깅용)"""
    whisper_provider = STTProviderFactory.get_provider(STTProviderType.WHISPER)
    faster_provider = STTProviderFactory.get_provider(STTProviderType.FASTER_WHISPER)

    return {
        "whisper": whisper_provider.get_model_info() if whisper_provider else None,
        "faster_whisper": faster_provider.get_model_info() if faster_provider else None
    }


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
