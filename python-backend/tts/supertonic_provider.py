"""
SupertonicTTSProvider - Supertonic TTS 구현

상용 TTS API를 ITTSProvider 인터페이스로 구현
- 유료 (API 키 필요)
- httpx를 사용한 비동기 HTTP 클라이언트
- Bearer 토큰 인증

에러 처리:
- 401: API 키 인증 실패
- 400: 잘못된 요청 (voice_id 오류 등)
- 429: 요청 제한 초과
- 500: 서버 에러

보안:
- HTTPS 강제
- API 키 검증 (빈 값 또는 플레이스홀더 거부)
"""

import httpx
import os
from typing import Dict, List, Any
from .base import ITTSProvider


class SupertonicTTSProvider(ITTSProvider):
    """
    Supertonic TTS 기반 음성 합성 Provider
    상용 API를 사용하여 고품질 음성 생성
    """

    def __init__(
        self,
        api_key: str,
        voice_id: str = "en-us-1",
        base_url: str = "https://api.supertonic.ai/v1",
    ):
        """
        SupertonicTTSProvider 초기화

        Args:
            api_key: Supertonic API 키 (필수)
            voice_id: 기본 음성 ID (기본값: en-us-1)
            base_url: Supertonic API 엔드포인트 (기본값: https://api.supertonic.ai/v1)

        Raises:
            ValueError: API 키가 유효하지 않거나 HTTPS 미사용 시
        """
        # API 키 검증
        if not api_key or api_key.strip() == "" or api_key == "your_api_key_here":
            raise ValueError(
                "Invalid SUPERTONIC_API_KEY. "
                "Please set a valid API key in .env file."
            )

        # HTTPS 강제
        if not base_url.startswith("https://"):
            raise ValueError(
                "Supertonic API URL must use HTTPS for security. "
                f"Provided URL: {base_url}"
            )

        self.api_key = api_key
        self.voice_id = voice_id
        self.base_url = base_url
        self.provider_name = "supertonic"

        # httpx AsyncClient 생성 (연결 재사용)
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60.0,
        )

        print(
            f"[SupertonicTTSProvider] Initialized with voice: {voice_id}, base_url: {base_url}"
        )

    async def synthesize_async(
        self, text: str, output_path: str, voice_id: str | None = None
    ) -> Dict[str, Any]:
        """
        Supertonic TTS API 호출하여 음성 합성

        API 스펙 (예상):
        POST /tts/synthesize
        Headers: { "Authorization": "Bearer {api_key}" }
        Body: {
            "text": str,
            "voice_id": str,
            "format": "mp3"
        }
        Response: 바이너리 MP3 데이터

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

            selected_voice = voice_id if voice_id else self.voice_id

            # API 호출
            response = await self.client.post(
                "/tts/synthesize",
                json={"text": text, "voice_id": selected_voice, "format": "mp3"},
            )

            # HTTP 상태 코드 확인
            if response.status_code != 200:
                error_detail = response.text

                # 401: 인증 실패
                if response.status_code == 401:
                    return {
                        "success": False,
                        "error": "Invalid API key",
                        "detail": "Supertonic API authentication failed",
                    }

                # 400: 잘못된 요청 (voice_id 오류 등)
                elif response.status_code == 400:
                    return {
                        "success": False,
                        "error": "Bad request",
                        "detail": f"Supertonic API error: {error_detail}",
                    }

                # 429: 요청 제한 초과
                elif response.status_code == 429:
                    return {
                        "success": False,
                        "error": "Rate limit exceeded",
                        "detail": "Too many requests. Please try again later.",
                    }

                # 기타 에러
                else:
                    return {
                        "success": False,
                        "error": f"Supertonic API error: {response.status_code}",
                        "detail": error_detail,
                    }

            # 파일 저장
            with open(output_path, "wb") as f:
                f.write(response.content)

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

            # duration 추정 (글자 수 기반)
            estimated_duration = len(text) / 12.5

            return {
                "success": True,
                "file_path": output_path,
                "duration": round(estimated_duration, 2),
                "voice_id": selected_voice,
                "provider": self.provider_name,
            }

        except httpx.HTTPStatusError as e:
            # HTTP 에러 (위에서 처리하지 못한 경우)
            return {
                "success": False,
                "error": "API request failed",
                "detail": f"HTTP error: {e.response.status_code}",
            }

        except httpx.NetworkError as e:
            # 네트워크 에러
            return {
                "success": False,
                "error": "Network error",
                "detail": "Failed to connect to Supertonic API",
            }

        except Exception as e:
            # 기타 예상치 못한 에러
            return {
                "success": False,
                "error": "TTS synthesis failed",
                "detail": str(e),
            }

    async def get_available_voices_async(self) -> List[Dict[str, str]]:
        """
        Supertonic TTS 음성 목록 조회

        API 스펙 (예상):
        GET /voices
        Response: {
            "voices": [
                {
                    "id": "en-us-1",
                    "name": "Emily (Female, US)",
                    "language": "en-US",
                    "gender": "female"
                },
                ...
            ]
        }

        Returns:
            음성 목록 배열 (API 실패 시 기본 목록 반환)
        """
        try:
            response = await self.client.get("/voices")

            if response.status_code != 200:
                print(
                    f"[SupertonicTTSProvider] Failed to get voices: {response.status_code}"
                )
                return self._get_default_voices()

            data = response.json()
            return data.get("voices", self._get_default_voices())

        except Exception as e:
            print(f"[SupertonicTTSProvider] Failed to get voices: {e}")
            return self._get_default_voices()

    def _get_default_voices(self) -> List[Dict[str, str]]:
        """API 실패 시 하드코딩된 기본 음성 목록"""
        return [
            {
                "id": "en-us-1",
                "name": "Emily (Female, US)",
                "language": "en-US",
                "gender": "female",
            },
            {
                "id": "en-us-2",
                "name": "Michael (Male, US)",
                "language": "en-US",
                "gender": "male",
            },
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
            "default_voice": self.voice_id,
        }

    async def __aenter__(self):
        """Context manager 진입"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager 종료 시 httpx 클라이언트 정리"""
        await self.client.aclose()
