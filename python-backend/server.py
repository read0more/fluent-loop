from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn
import os
import tempfile
from datetime import datetime
from tts import TTSProviderFactory, ITTSProvider
from stt_provider import (
    STTProviderFactory,
    STTProviderType,
    STTResult,
    ISTTProvider,
    FasterWhisperSTTProvider
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
tts_provider: ITTSProvider | None = None

# STT Provider 인스턴스 - faster-whisper 통일 (KAN-21)
stt_step3_provider: ISTTProvider | None = None  # Step3용 (medium 모델, 인식률 우선)
stt_step5_provider: ISTTProvider | None = None  # Step5용 (small 모델, 속도 우선)

# 현재 Step5 provider의 GPU 사용 설정 추적
_current_step5_use_gpu: bool | None = None

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
    """앱 시작 시 STT 모델 및 TTS 서비스 로드"""
    global tts_provider, stt_step3_provider, stt_step5_provider, _current_step5_use_gpu

    # STT Provider 초기화 - faster-whisper 통일 (KAN-21)
    print("Initializing STT Providers (faster-whisper)...")
    use_gpu = os.getenv("STT_USE_GPU", "false").lower() == "true"

    try:
        # Step3용 faster-whisper Provider (medium 모델, 인식률 우선)
        print(f"[Server] Loading Step3 STT model (medium, gpu={use_gpu})...")
        stt_step3_provider = FasterWhisperSTTProvider(
            model_size="medium",
            compute_type="auto",
            use_gpu=use_gpu
        )

        # Step5용 faster-whisper Provider (small 모델, 속도 우선)
        print(f"[Server] Loading Step5 STT model (small, gpu={use_gpu})...")
        stt_step5_provider = FasterWhisperSTTProvider(
            model_size="small",
            compute_type="auto",
            use_gpu=use_gpu
        )
        _current_step5_use_gpu = use_gpu

        print("[Server] All STT Providers initialized (faster-whisper)")
    except Exception as e:
        print(f"[ERROR] Failed to initialize STT providers: {e}")

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
    if stt_step3_provider is None and stt_step5_provider is None:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": "STT models not loaded",
                "timestamp": datetime.now().isoformat()
            }
        )

    # STT Provider 정보 수집
    step3_info = stt_step3_provider.get_model_info() if stt_step3_provider else None
    step5_info = stt_step5_provider.get_model_info() if stt_step5_provider else None

    health_data = {
        "status": "ok",
        "stt_loaded": True,
        "stt_step3_model": step3_info["version"] if step3_info else None,
        "stt_step5_model": step5_info["version"] if step5_info else None,
        "stt_device": step3_info["device"] if step3_info else None,
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
    오디오 파일을 텍스트로 변환 (Step3용 - medium 모델)

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
    if stt_step3_provider is None:
        raise HTTPException(
            status_code=503,
            detail="STT model not loaded"
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

        # STT 실행 (Step3용 medium 모델)
        result = stt_step3_provider.transcribe(temp_path, language=language)

        # 빈 텍스트 확인
        if not result.text:
            return {
                "success": False,
                "error": "No speech detected",
                "text": "",
                "language": language,
                "duration": result.duration or 0.0
            }

        return {
            "success": True,
            "text": result.text,
            "language": result.language,
            "duration": result.duration or 0.0
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


# ==================== STT 스트리밍 엔드포인트 (Step5용) ====================

@app.post("/stt/stream-chunk")
async def transcribe_audio_chunk(
    audio: UploadFile = File(...),
    language: str = Form("ko"),
    context: str = Form(""),  # 이전 청크의 텍스트 (컨텍스트)
    use_gpu: str = Form("false")  # GPU 사용 여부 ('true' | 'false')
) -> STTResult:
    """
    오디오 청크 실시간 STT 변환 (Step5 RolePlay용 - small 모델)

    Args:
        audio: 오디오 청크 파일 (2-3초)
        language: 언어 코드
        context: 이전 청크의 텍스트 (정확도 향상용)
        use_gpu: GPU 사용 여부 ('true' | 'false')

    Returns:
        STTResult: 변환 결과 (is_final=False)
    """
    global stt_step5_provider, _current_step5_use_gpu

    # use_gpu 파라미터 파싱 (문자열 -> bool)
    use_gpu_bool = use_gpu.lower() == "true"

    # GPU 설정이 변경되면 provider 재생성
    if _current_step5_use_gpu is not None and _current_step5_use_gpu != use_gpu_bool:
        print(f"[Server] GPU setting changed: {_current_step5_use_gpu} -> {use_gpu_bool}, recreating Step5 provider...")
        stt_step5_provider = FasterWhisperSTTProvider(
            model_size="small",
            compute_type="auto",
            use_gpu=use_gpu_bool
        )
        _current_step5_use_gpu = use_gpu_bool

    # Provider가 없으면 생성
    if stt_step5_provider is None:
        print(f"[Server] Creating Step5 STT provider with use_gpu={use_gpu_bool}")
        stt_step5_provider = FasterWhisperSTTProvider(
            model_size="small",
            compute_type="auto",
            use_gpu=use_gpu_bool
        )
        _current_step5_use_gpu = use_gpu_bool

    temp_dir = tempfile.gettempdir()
    chunk_path = os.path.join(temp_dir, f"chunk_{os.getpid()}_{os.urandom(4).hex()}.webm")

    try:
        with open(chunk_path, "wb") as f:
            f.write(await audio.read())

        # Step5용 faster-whisper Provider 사용
        result = stt_step5_provider.transcribe_chunk(
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
    return {
        "step3": stt_step3_provider.get_model_info() if stt_step3_provider else None,
        "step5": stt_step5_provider.get_model_info() if stt_step5_provider else None
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
