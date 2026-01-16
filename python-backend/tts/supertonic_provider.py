"""
SupertonicTTSProvider - Supertonic TTS 구현

온디바이스 TTS (로컬 ONNX 추론)
- API 키 불필요
- 모델 자동 다운로드 (~260MB)
- 오프라인 동작 가능

사용법:
    provider = SupertonicTTSProvider(voice_name="M4")
    result = await provider.synthesize_async(text, output_path)
"""

import os
import asyncio
from typing import Dict, List, Any
from .base import ITTSProvider

# Supertonic 로컬 TTS
from supertonic import TTS


class SupertonicTTSProvider(ITTSProvider):
    """
    Supertonic TTS 기반 음성 합성 Provider
    로컬 ONNX 추론을 사용하여 음성 생성 (API 키 불필요)
    """

    def __init__(self, voice_name: str = "M4"):
        """
        SupertonicTTSProvider 초기화

        Args:
            voice_name: 음성 스타일 이름 (예: "M1", "M4" 등)
        """
        self.voice_name = voice_name
        self.provider_name = "supertonic"

        # TTS 엔진 초기화 (모델 자동 다운로드)
        print(f"[SupertonicTTSProvider] Initializing TTS engine (auto_download=True)...")
        self.tts = TTS(auto_download=True)

        # 음성 스타일 로드
        print(f"[SupertonicTTSProvider] Loading voice style: {voice_name}")
        self.voice_style = self.tts.get_voice_style(voice_name=voice_name)

        print(f"[SupertonicTTSProvider] Initialized successfully with voice: {voice_name}")

    async def synthesize_async(
        self, text: str, output_path: str, voice_id: str | None = None
    ) -> Dict[str, Any]:
        """
        Supertonic TTS로 음성 합성 (로컬 추론)

        Args:
            text: 변환할 텍스트
            output_path: 저장할 파일 경로
            voice_id: 사용할 음성 이름 (None이면 기본 음성 사용)

        Returns:
            {
                "success": bool,
                "file_path": str,
                "duration": float,
                "voice_id": str,
                "provider": str,
                "error": str (실패 시)
            }
        """
        try:
            # 빈 텍스트 검증
            if not text or not text.strip():
                return {
                    "success": False,
                    "error": "Empty text provided",
                    "detail": "Text cannot be empty",
                }

            # 음성 스타일 선택
            voice_style = self.voice_style
            selected_voice = self.voice_name

            if voice_id and voice_id != self.voice_name:
                try:
                    voice_style = self.tts.get_voice_style(voice_name=voice_id)
                    selected_voice = voice_id
                except Exception as e:
                    print(f"[SupertonicTTSProvider] Voice '{voice_id}' not found, using default: {self.voice_name}")

            # 동기 TTS 합성을 비동기로 실행 (블로킹 방지)
            loop = asyncio.get_event_loop()
            wav, duration = await loop.run_in_executor(
                None,
                lambda: self.tts.synthesize(text, voice_style=voice_style)
            )

            # 오디오 파일 저장
            await loop.run_in_executor(
                None,
                lambda: self.tts.save_audio(wav, output_path)
            )

            # 파일 검증
            if not os.path.exists(output_path):
                return {
                    "success": False,
                    "error": "Failed to save audio file",
                    "detail": "Output file was not created",
                }

            file_size = os.path.getsize(output_path)
            if file_size == 0:
                return {
                    "success": False,
                    "error": "Generated audio file is empty",
                    "detail": "File size is 0 bytes",
                }

            # duration은 numpy array이므로 float으로 변환
            audio_duration = float(duration[0]) if hasattr(duration, '__getitem__') else float(duration)

            return {
                "success": True,
                "file_path": output_path,
                "duration": round(audio_duration, 2),
                "voice_id": selected_voice,
                "provider": self.provider_name,
            }

        except Exception as e:
            return {
                "success": False,
                "error": "TTS synthesis failed",
                "detail": str(e),
            }

    async def get_available_voices_async(self) -> List[Dict[str, str]]:
        """
        Supertonic TTS 음성 목록 반환

        Returns:
            음성 목록 배열
        """
        # Supertonic 기본 음성 스타일 목록
        return [
            {"id": "M1", "name": "Male 1", "language": "en", "gender": "male"},
            {"id": "M2", "name": "Male 2", "language": "en", "gender": "male"},
            {"id": "M3", "name": "Male 3", "language": "en", "gender": "male"},
            {"id": "M4", "name": "Male 4", "language": "en", "gender": "male"},
            {"id": "F1", "name": "Female 1", "language": "en", "gender": "female"},
            {"id": "F2", "name": "Female 2", "language": "en", "gender": "female"},
        ]

    def get_provider_info(self) -> Dict[str, str]:
        """
        프로바이더 정보 반환

        Returns:
            {
                "provider": "supertonic",
                "version": "1.0.0",
                "default_voice": str
            }
        """
        return {
            "provider": self.provider_name,
            "version": "1.0.0",
            "default_voice": self.voice_name,
        }
