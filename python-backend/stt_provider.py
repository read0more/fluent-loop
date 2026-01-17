"""
STT Provider 추상화 모듈

이 모듈은 SOLID 원칙 중 OCP(개방-폐쇄 원칙)와 DIP(의존성 역전 원칙)를 따릅니다.
- 새로운 STT 엔진 추가 시 기존 코드 수정 최소화
- 추상화에 의존하여 구체적인 구현체로부터 독립

작성일: 2026-01-17
관련 이슈: KAN-21
"""

from abc import ABC, abstractmethod
from typing import Optional
from enum import Enum
from pydantic import BaseModel
import whisper
import torch
from faster_whisper import WhisperModel


# ==================== 데이터 모델 ====================

class STTResult(BaseModel):
    """STT 변환 결과 모델"""
    success: bool
    text: str
    language: str
    duration: Optional[float] = None
    is_final: bool = False  # 스트리밍용: 최종 결과 여부
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "text": "안녕하세요",
                "language": "ko",
                "duration": 2.3,
                "is_final": False
            }
        }


# ==================== STT Provider 인터페이스 ====================

class ISTTProvider(ABC):
    """STT Provider 추상 인터페이스 (ISP - 인터페이스 분리 원칙)"""

    @abstractmethod
    def transcribe(self, audio_path: str, language: str = "ko") -> STTResult:
        """
        전체 오디오 파일을 한 번에 변환 (배치 처리)

        Args:
            audio_path: 오디오 파일 경로
            language: 언어 코드 (ko, en)

        Returns:
            STTResult: 변환 결과
        """
        pass

    @abstractmethod
    def transcribe_chunk(
        self,
        audio_path: str,
        language: str = "ko",
        context: Optional[str] = None
    ) -> STTResult:
        """
        오디오 청크를 실시간으로 변환 (스트리밍 처리)

        Args:
            audio_path: 청크 오디오 파일 경로
            language: 언어 코드
            context: 이전 청크의 텍스트 (컨텍스트 유지용)

        Returns:
            STTResult: 변환 결과 (is_final=False)
        """
        pass

    @abstractmethod
    def get_model_info(self) -> dict:
        """
        모델 정보 반환

        Returns:
            dict: { "name": str, "version": str, "language_support": list }
        """
        pass


# ==================== WhisperSTTProvider (기존 - 리팩토링) ====================

class WhisperSTTProvider(ISTTProvider):
    """OpenAI Whisper 기반 STT Provider (Step3용 배치 처리)"""

    def __init__(self, model_size: str = "base"):
        """
        Args:
            model_size: 모델 크기 (tiny, base, small, medium, large)
        """
        self.model_size = model_size
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = whisper.load_model(model_size, device=self.device)
        print(f"[WhisperSTT] Model loaded: {model_size} on {self.device}")

    def transcribe(self, audio_path: str, language: str = "ko") -> STTResult:
        """전체 파일 배치 처리"""
        try:
            result = self.model.transcribe(
                audio_path,
                language=language,
                fp16=False
            )

            return STTResult(
                success=True,
                text=result["text"].strip(),
                language=language,
                duration=result.get("duration"),
                is_final=True
            )
        except Exception as e:
            return STTResult(
                success=False,
                text="",
                language=language,
                error=str(e)
            )

    def transcribe_chunk(
        self,
        audio_path: str,
        language: str = "ko",
        context: Optional[str] = None
    ) -> STTResult:
        """청크 처리 (WhisperSTT는 배치 전용이므로 전체 처리와 동일)"""
        result = self.transcribe(audio_path, language)
        result.is_final = False  # 청크 처리 시 is_final=False
        return result

    def get_model_info(self) -> dict:
        return {
            "name": "OpenAI Whisper",
            "version": self.model_size,
            "language_support": ["ko", "en", "ja", "zh", "es", "fr", "de"]
        }


# ==================== FasterWhisperSTTProvider (신규 - Step5 실시간용) ====================

class FasterWhisperSTTProvider(ISTTProvider):
    """faster-whisper 기반 STT Provider (Step5 실시간 스트리밍용)"""

    def __init__(self, model_size: str = "base", compute_type: str = "auto"):
        """
        Args:
            model_size: 모델 크기 (tiny, base, small, medium, large-v2, large-v3)
            compute_type: 연산 타입 (int8, int8_float16, float16, float32, auto)
        """
        self.model_size = model_size

        # GPU 사용 가능 시 CUDA, 아니면 CPU
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # compute_type 자동 결정
        if compute_type == "auto":
            if self.device == "cuda":
                self.compute_type = "float16"
            else:
                self.compute_type = "int8"
        else:
            self.compute_type = compute_type

        # faster-whisper 모델 로드
        self.model = WhisperModel(
            model_size,
            device=self.device,
            compute_type=self.compute_type
        )

        print(f"[FasterWhisperSTT] Model loaded: {model_size} on {self.device} ({self.compute_type})")

    def transcribe(self, audio_path: str, language: str = "ko") -> STTResult:
        """전체 파일 배치 처리"""
        try:
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                beam_size=5,
                vad_filter=True,  # Voice Activity Detection 사용
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            # segments를 텍스트로 결합
            text = " ".join([segment.text for segment in segments]).strip()

            return STTResult(
                success=True,
                text=text,
                language=language,
                duration=info.duration,
                is_final=True
            )
        except Exception as e:
            return STTResult(
                success=False,
                text="",
                language=language,
                error=str(e)
            )

    def transcribe_chunk(
        self,
        audio_path: str,
        language: str = "ko",
        context: Optional[str] = None
    ) -> STTResult:
        """
        청크 실시간 처리 (Step5 스트리밍용)

        Args:
            audio_path: 청크 오디오 파일 (2-3초)
            language: 언어 코드
            context: 이전 청크의 텍스트 (컨텍스트 유지, 정확도 향상)
        """
        try:
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                beam_size=3,  # 빠른 처리를 위해 beam_size 축소
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=300),
                initial_prompt=context  # 이전 컨텍스트 제공
            )

            text = " ".join([segment.text for segment in segments]).strip()

            return STTResult(
                success=True,
                text=text,
                language=language,
                duration=info.duration,
                is_final=False  # 청크 처리는 중간 결과
            )
        except Exception as e:
            return STTResult(
                success=False,
                text="",
                language=language,
                error=str(e)
            )

    def get_model_info(self) -> dict:
        return {
            "name": "faster-whisper",
            "version": self.model_size,
            "language_support": ["ko", "en", "ja", "zh", "es", "fr", "de"],
            "device": self.device,
            "compute_type": self.compute_type
        }


# ==================== STT Provider 팩토리 ====================

class STTProviderType(str, Enum):
    WHISPER = "whisper"
    FASTER_WHISPER = "faster-whisper"


class STTProviderFactory:
    """STT Provider 팩토리 (싱글톤 패턴)"""

    _providers: dict[STTProviderType, ISTTProvider] = {}

    @classmethod
    def create_provider(
        cls,
        provider_type: STTProviderType,
        model_size: str = "base",
        compute_type: str = "auto"
    ) -> ISTTProvider:
        """
        Provider 생성 (싱글톤 패턴)

        Args:
            provider_type: Provider 타입
            model_size: 모델 크기
            compute_type: 연산 타입 (faster-whisper only)

        Returns:
            ISTTProvider 구현체
        """
        # 이미 생성된 Provider 재사용 (메모리 절약)
        if provider_type in cls._providers:
            return cls._providers[provider_type]

        if provider_type == STTProviderType.WHISPER:
            provider = WhisperSTTProvider(model_size=model_size)
        elif provider_type == STTProviderType.FASTER_WHISPER:
            provider = FasterWhisperSTTProvider(
                model_size=model_size,
                compute_type=compute_type
            )
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")

        cls._providers[provider_type] = provider
        return provider

    @classmethod
    def get_provider(cls, provider_type: STTProviderType) -> Optional[ISTTProvider]:
        """이미 생성된 Provider 반환"""
        return cls._providers.get(provider_type)
