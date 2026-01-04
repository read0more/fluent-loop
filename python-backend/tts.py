import edge_tts
import asyncio
import os
from typing import Dict, List, Any


class EdgeTTSService:
    """
    Edge TTS 기반 음성 합성 서비스
    Microsoft Edge의 TTS 엔진을 사용하여 고품질 음성 생성
    """

    def __init__(self, voice_id: str = "en-US-AriaNeural"):
        """
        TTS 서비스 초기화

        Args:
            voice_id: 기본 음성 ID (예: en-US-AriaNeural)
        """
        self.voice_id = voice_id
        print(f"Edge TTS initialized with voice: {voice_id}")

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
                "error": str (실패 시)
            }
        """
        try:
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
            }

        except Exception as e:
            error_msg = str(e)
            if "voice" in error_msg.lower():
                return {
                    "success": False,
                    "error": "Voice not found",
                    "detail": f"Invalid voice ID: {voice_id}",
                }
            else:
                return {
                    "success": False,
                    "error": "TTS synthesis failed",
                    "detail": error_msg,
                }

    def synthesize(
        self, text: str, output_path: str, voice_id: str | None = None
    ) -> Dict[str, Any]:
        """
        텍스트를 음성으로 동기 변환 (async 래퍼)

        Args:
            text: 변환할 텍스트
            output_path: 저장할 파일 경로
            voice_id: 사용할 음성 ID

        Returns:
            synthesize_async와 동일
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                self.synthesize_async(text, output_path, voice_id)
            )
            return result
        finally:
            loop.close()

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
            print(f"Failed to get voices: {e}")
            # 실패 시 기본 음성 목록 반환
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

    def get_available_voices(self) -> List[Dict[str, str]]:
        """
        사용 가능한 음성 목록 조회 (동기)

        Returns:
            get_available_voices_async와 동일
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            voices = loop.run_until_complete(self.get_available_voices_async())
            return voices
        finally:
            loop.close()

    def get_voice_info(self) -> Dict[str, Any]:
        """
        현재 음성 정보 반환

        Returns:
            {
                "voice_id": str,
                "provider": str
            }
        """
        return {"voice_id": self.voice_id, "provider": "Microsoft Edge TTS"}
