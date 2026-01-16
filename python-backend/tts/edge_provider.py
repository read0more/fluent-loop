"""
EdgeTTSProvider - Microsoft Edge TTS 구현

기존 tts.py의 EdgeTTSService를 ITTSProvider 인터페이스로 리팩토링
- 무료
- 로컬 실행
- 고품질 음성

마이그레이션 노트:
- EdgeTTSService → EdgeTTSProvider로 클래스명 변경
- ITTSProvider 인터페이스 구현
- get_provider_info() 메서드 추가
- provider 필드를 반환값에 추가
"""

import edge_tts
import os
from typing import Dict, List, Any
from .base import ITTSProvider


class EdgeTTSProvider(ITTSProvider):
    """
    Edge TTS 기반 음성 합성 Provider
    Microsoft Edge의 TTS 엔진을 사용하여 고품질 음성 생성
    """

    def __init__(self, voice_id: str = "en-US-AriaNeural"):
        """
        EdgeTTSProvider 초기화

        Args:
            voice_id: 기본 음성 ID (예: en-US-AriaNeural)
        """
        self.voice_id = voice_id
        self.provider_name = "edge-tts"
        print(f"[EdgeTTSProvider] Initialized with voice: {voice_id}")

    async def synthesize_async(
        self, text: str, output_path: str, voice_id: str | None = None
    ) -> Dict[str, Any]:
        """
        텍스트를 음성으로 비동기 변환

        Args:
            text: 변환할 텍스트
            output_path: 저장할 파일 경로
            voice_id: 사용할 음성 ID (None이면 기본 음성 사용)

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

            # 음성 ID 결정
            selected_voice = voice_id if voice_id else self.voice_id

            # TTS 객체 생성
            communicate = edge_tts.Communicate(text, selected_voice)

            # 음성 파일 생성
            await communicate.save(output_path)

            # 파일 존재 및 크기 확인
            if not os.path.exists(output_path):
                return {
                    "success": False,
                    "error": "Failed to create audio file",
                    "detail": "Output file was not created",
                }

            file_size = os.path.getsize(output_path)
            if file_size == 0:
                return {
                    "success": False,
                    "error": "Generated audio file is empty",
                    "detail": "File size is 0 bytes",
                }

            # 대략적인 duration 계산 (글자 수 기반)
            # 평균적으로 영어는 분당 150단어, 단어당 5글자 = 750자/분 = 12.5자/초
            estimated_duration = len(text) / 12.5

            return {
                "success": True,
                "file_path": output_path,
                "duration": round(estimated_duration, 2),
                "voice_id": selected_voice,
                "provider": self.provider_name,
            }

        except Exception as e:
            error_msg = str(e)
            # 음성 관련 에러 구분
            if "voice" in error_msg.lower() or "not found" in error_msg.lower():
                return {
                    "success": False,
                    "error": "Voice not found",
                    "detail": f"Invalid voice ID: {voice_id or self.voice_id}",
                }
            else:
                return {
                    "success": False,
                    "error": "TTS synthesis failed",
                    "detail": error_msg,
                }

    async def get_available_voices_async(self) -> List[Dict[str, str]]:
        """
        사용 가능한 음성 목록 조회 (비동기)

        Returns:
            [
                {
                    "id": "en-US-AriaNeural",
                    "name": "Aria (Female, US)",
                    "language": "en-US",
                    "gender": "female"
                },
                ...
            ]
        """
        try:
            voices = await edge_tts.list_voices()

            # 영어 음성만 필터링 및 정리
            english_voices = []
            for voice in voices:
                locale = voice.get("Locale", "")
                if locale.startswith("en-"):
                    gender = voice.get("Gender", "").lower()
                    name = voice.get("ShortName", "")
                    friendly_name = voice.get("FriendlyName", name)

                    english_voices.append(
                        {
                            "id": name,
                            "name": friendly_name,
                            "language": locale,
                            "gender": gender,
                        }
                    )

            return english_voices

        except Exception as e:
            print(f"[EdgeTTSProvider] Failed to get voices: {e}")
            # 실패 시 기본 음성 목록 반환
            return self._get_default_voices()

    def _get_default_voices(self) -> List[Dict[str, str]]:
        """API 실패 시 하드코딩된 기본 음성 목록"""
        return [
            {
                "id": "en-US-AriaNeural",
                "name": "Aria (Female, US)",
                "language": "en-US",
                "gender": "female",
            },
            {
                "id": "en-US-GuyNeural",
                "name": "Guy (Male, US)",
                "language": "en-US",
                "gender": "male",
            },
            {
                "id": "en-GB-SoniaNeural",
                "name": "Sonia (Female, UK)",
                "language": "en-GB",
                "gender": "female",
            },
            {
                "id": "en-GB-RyanNeural",
                "name": "Ryan (Male, UK)",
                "language": "en-GB",
                "gender": "male",
            },
        ]

    def get_provider_info(self) -> Dict[str, str]:
        """
        프로바이더 정보 반환

        Returns:
            {
                "provider": "edge-tts",
                "version": "6.1.12+",
                "default_voice": str
            }
        """
        return {
            "provider": self.provider_name,
            "version": "6.1.12+",
            "default_voice": self.voice_id,
        }
