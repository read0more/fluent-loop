"""
TTS Provider 추상화 및 Supertonic TTS 통합 테스트

테스트 프레임워크: pytest + pytest-asyncio + pytest-mock
커버리지 목표: 85% 이상

작성일: 2026-01-15
참고 문서: claude.config/dev-workflow/docs/test-cases.md
"""

import os
import pytest
from unittest.mock import AsyncMock, Mock, patch
from pathlib import Path
from tts.base import ITTSProvider
from tts.edge_provider import EdgeTTSProvider
from tts.supertonic_provider import SupertonicTTSProvider
from tts.factory import TTSProviderFactory


# ============================================================
# 1. ITTSProvider 추상 클래스 테스트
# ============================================================


class TestITTSProvider:
    """ITTSProvider 추상 클래스 검증 (TC-UNIT-001)"""

    def test_cannot_instantiate_abstract_class(self):
        """TC-UNIT-001-1: ITTSProvider 직접 인스턴스화 불가"""
        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            ITTSProvider()

    def test_must_implement_all_abstract_methods(self):
        """TC-UNIT-001-2: 추상 메서드 미구현 시 TypeError 발생"""
        # 불완전한 구현 클래스
        class IncompleteProvider(ITTSProvider):
            pass

        with pytest.raises(TypeError, match="Can't instantiate abstract class"):
            IncompleteProvider()


# ============================================================
# 2. EdgeTTSProvider 테스트
# ============================================================


class TestEdgeTTSProvider:
    """EdgeTTSProvider 단위 테스트 (TC-UNIT-002 ~ 005)"""

    def test_tc_unit_002_initialization(self):
        """TC-UNIT-002: EdgeTTSProvider 초기화"""
        # 기본 음성으로 초기화
        provider = EdgeTTSProvider(voice_id="en-US-AriaNeural")
        assert provider.voice_id == "en-US-AriaNeural"
        assert provider.provider_name == "edge-tts"

        # 커스텀 음성으로 초기화
        provider2 = EdgeTTSProvider(voice_id="en-GB-SoniaNeural")
        assert provider2.voice_id == "en-GB-SoniaNeural"

    @pytest.mark.asyncio
    async def test_tc_unit_003_synthesize_async_success(self):
        """TC-UNIT-003: EdgeTTSProvider 음성 합성 성공"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider(voice_id="en-US-AriaNeural")

        # 임시 파일 경로
        import tempfile

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_edge_tts.mp3")

        # 음성 합성
        result = await provider.synthesize_async(
            text="Hello, this is a test.", output_path=output_path
        )

        # 검증
        assert result["success"] is True
        assert result["file_path"] == output_path
        assert result["voice_id"] == "en-US-AriaNeural"
        assert result["duration"] > 0
        assert result["provider"] == "edge-tts"
        assert os.path.exists(result["file_path"])

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

    @pytest.mark.asyncio
    async def test_tc_unit_004_get_available_voices_async(self):
        """TC-UNIT-004: EdgeTTSProvider 음성 목록 조회"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider()

        voices = await provider.get_available_voices_async()

        # 검증
        assert len(voices) > 0
        assert all("id" in v for v in voices)
        assert all("name" in v for v in voices)
        assert all("language" in v for v in voices)
        assert all("gender" in v for v in voices)

    def test_tc_unit_005_get_provider_info(self):
        """TC-UNIT-005: EdgeTTSProvider 프로바이더 정보 조회"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider(voice_id="en-US-AriaNeural")
        info = provider.get_provider_info()

        # 검증
        assert info["provider"] == "edge-tts"
        assert "version" in info
        assert info["default_voice"] == "en-US-AriaNeural"


# ============================================================
# 3. SupertonicTTSProvider 테스트 (Mock)
# ============================================================


class TestSupertonicTTSProvider:
    """SupertonicTTSProvider 단위 테스트 (TC-UNIT-006 ~ 010)"""

    def test_tc_unit_006_initialization(self):
        """TC-UNIT-006: SupertonicTTSProvider 초기화"""
        from tts.supertonic_provider import SupertonicTTSProvider

        provider = SupertonicTTSProvider(
            api_key="test_api_key_123",
            voice_id="en-us-1",
            base_url="https://api.supertonic.ai/v1",
        )

        # 검증
        assert provider.api_key == "test_api_key_123"
        assert provider.voice_id == "en-us-1"
        assert provider.provider_name == "supertonic"

    @pytest.mark.asyncio
    async def test_tc_unit_007_synthesize_async_success_mock(self):
        """TC-UNIT-007: SupertonicTTSProvider 음성 합성 성공 (Mock)"""
        from tts.supertonic_provider import SupertonicTTSProvider

        provider = SupertonicTTSProvider(
            api_key="test_key", voice_id="en-us-1"
        )

        # httpx.AsyncClient.post Mock
        with patch.object(provider.client, "post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.content = b"fake_mp3_binary_data"
            mock_post.return_value = mock_response

            import tempfile

            temp_dir = tempfile.gettempdir()
            output_path = os.path.join(temp_dir, "test_supertonic.mp3")

            # 음성 합성
            result = await provider.synthesize_async(
                text="Test", output_path=output_path
            )

            # 검증
            assert result["success"] is True
            assert result["provider"] == "supertonic"
            assert result["voice_id"] == "en-us-1"
            assert result["file_path"] == output_path
            assert result["duration"] > 0

            # API 호출 확인
            mock_post.assert_called_once()

            # 정리
            if os.path.exists(output_path):
                os.remove(output_path)

    @pytest.mark.asyncio
    async def test_tc_unit_008_synthesize_async_auth_failure(self):
        """TC-UNIT-008: SupertonicTTSProvider API 인증 실패 (401)"""
        from tts.supertonic_provider import SupertonicTTSProvider

        provider = SupertonicTTSProvider(api_key="invalid_key")

        # httpx.AsyncClient.post Mock (401 응답)
        with patch.object(provider.client, "post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 401
            mock_response.text = "Unauthorized"
            mock_post.return_value = mock_response

            import tempfile

            temp_dir = tempfile.gettempdir()
            output_path = os.path.join(temp_dir, "test.mp3")

            # 음성 합성 (실패 예상)
            result = await provider.synthesize_async(
                text="Test", output_path=output_path
            )

            # 검증
            assert result["success"] is False
            assert "Invalid API key" in result["error"]

    @pytest.mark.asyncio
    async def test_tc_unit_009_get_available_voices_async_mock(self):
        """TC-UNIT-009: SupertonicTTSProvider 음성 목록 조회 (Mock)"""
        from tts.supertonic_provider import SupertonicTTSProvider

        provider = SupertonicTTSProvider(api_key="test_key")

        # httpx.AsyncClient.get Mock
        with patch.object(provider.client, "get") as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json = Mock(return_value={
                "voices": [
                    {
                        "id": "en-us-1",
                        "name": "Emily (Female, US)",
                        "language": "en-US",
                        "gender": "female",
                    }
                ]
            })
            # AsyncMock for the coroutine
            mock_get.return_value = mock_response

            # 음성 목록 조회
            voices = await provider.get_available_voices_async()

            # 검증
            assert len(voices) == 1
            assert voices[0]["id"] == "en-us-1"
            assert voices[0]["name"] == "Emily (Female, US)"

    @pytest.mark.asyncio
    async def test_tc_unit_010_get_default_voices_on_api_failure(self):
        """TC-UNIT-010: SupertonicTTSProvider 기본 음성 목록 (Fallback)"""
        from tts.supertonic_provider import SupertonicTTSProvider

        provider = SupertonicTTSProvider(api_key="test_key")

        # httpx.AsyncClient.get Mock (500 에러)
        with patch.object(provider.client, "get") as mock_get:
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_get.return_value = mock_response

            # 음성 목록 조회 (fallback)
            voices = await provider.get_available_voices_async()

            # 검증: 기본 음성 목록 반환
            assert len(voices) >= 1
            assert all("id" in v for v in voices)


# ============================================================
# 4. TTSProviderFactory 테스트
# ============================================================


class TestTTSProviderFactory:
    """TTSProviderFactory 단위 테스트 (TC-UNIT-011 ~ 015)"""

    def test_tc_unit_011_create_edge_tts_provider(self, monkeypatch):
        """TC-UNIT-011: Factory로 EdgeTTSProvider 생성"""
        from tts.factory import TTSProviderFactory
        from tts.edge_provider import EdgeTTSProvider

        # 환경 변수 설정
        monkeypatch.setenv("TTS_PROVIDER", "edge-tts")
        monkeypatch.setenv("TTS_VOICE", "en-US-GuyNeural")

        # Factory로 Provider 생성
        provider = TTSProviderFactory.create_provider()

        # 검증
        assert isinstance(provider, EdgeTTSProvider)
        assert provider.voice_id == "en-US-GuyNeural"

    def test_tc_unit_012_create_supertonic_provider(self, monkeypatch):
        """TC-UNIT-012: Factory로 SupertonicTTSProvider 생성"""
        from tts.factory import TTSProviderFactory
        from tts.supertonic_provider import SupertonicTTSProvider

        # 환경 변수 설정
        monkeypatch.setenv("TTS_PROVIDER", "supertonic")
        monkeypatch.setenv("SUPERTONIC_API_KEY", "test_key")
        monkeypatch.setenv("SUPERTONIC_VOICE", "en-us-2")

        # Factory로 Provider 생성
        provider = TTSProviderFactory.create_provider()

        # 검증
        assert isinstance(provider, SupertonicTTSProvider)
        assert provider.voice_id == "en-us-2"

    def test_tc_unit_013_create_provider_missing_api_key(self, monkeypatch):
        """TC-UNIT-013: Factory API 키 누락 에러"""
        from tts.factory import TTSProviderFactory

        # 환경 변수 설정 (API 키 누락)
        monkeypatch.setenv("TTS_PROVIDER", "supertonic")
        monkeypatch.delenv("SUPERTONIC_API_KEY", raising=False)

        # Factory로 Provider 생성 (에러 예상)
        with pytest.raises(ValueError, match="SUPERTONIC_API_KEY"):
            TTSProviderFactory.create_provider()

    def test_tc_unit_014_create_provider_unknown_type(self, monkeypatch):
        """TC-UNIT-014: Factory 지원하지 않는 프로바이더 에러"""
        from tts.factory import TTSProviderFactory

        # 환경 변수 설정 (지원하지 않는 프로바이더)
        monkeypatch.setenv("TTS_PROVIDER", "google-tts")

        # Factory로 Provider 생성 (에러 예상)
        with pytest.raises(ValueError, match="Unknown TTS_PROVIDER"):
            TTSProviderFactory.create_provider()

    def test_tc_unit_015_create_provider_default(self, monkeypatch):
        """TC-UNIT-015: Factory 기본값 (TTS_PROVIDER 미설정)"""
        from tts.factory import TTSProviderFactory
        from tts.supertonic_provider import SupertonicTTSProvider

        # 환경 변수 설정 (TTS_PROVIDER 미설정)
        monkeypatch.delenv("TTS_PROVIDER", raising=False)
        monkeypatch.setenv("SUPERTONIC_API_KEY", "test_key")

        # Factory로 Provider 생성 (기본값: supertonic)
        provider = TTSProviderFactory.create_provider()

        # 검증
        assert isinstance(provider, SupertonicTTSProvider)


# ============================================================
# 5. FastAPI 엔드포인트 통합 테스트
# ============================================================


class TestFastAPIEndpoints:
    """FastAPI TTS 엔드포인트 통합 테스트 (TC-INTG-001 ~ 003)"""

    @pytest.fixture
    def mock_tts_provider(self):
        """Mock TTS Provider"""
        from tts.base import ITTSProvider

        mock_provider = Mock(spec=ITTSProvider)
        mock_provider.get_provider_info.return_value = {
            "provider": "edge-tts",
            "version": "6.1.12",
            "default_voice": "en-US-AriaNeural",
        }
        return mock_provider

    def test_tc_intg_001_health_check_with_tts_provider(
        self, mock_tts_provider
    ):
        """TC-INTG-001: /health 엔드포인트 TTS 프로바이더 정보 포함"""
        pytest.skip("Server implementation not ready")

        # TODO: After server.py implementation
        # from fastapi.testclient import TestClient
        # from server import app
        #
        # client = TestClient(app)
        # response = client.get("/health")
        #
        # assert response.status_code == 200
        # data = response.json()
        # assert data["status"] == "ok"
        # assert "tts_provider" in data
        # assert "tts_voice" in data
        # assert data["tts_provider"] in ["edge-tts", "supertonic"]

    def test_tc_intg_002_tts_synthesize_integration(self):
        """TC-INTG-002: /tts/synthesize 엔드포인트 정상 동작"""
        pytest.skip("Server implementation not ready")

        # TODO: After server.py implementation
        # response = client.post(
        #     "/tts/synthesize",
        #     json={"text": "Integration test", "voice_id": None}
        # )
        #
        # assert response.status_code == 200
        # data = response.json()
        # assert data["success"] is True
        # assert "file_path" in data
        # assert os.path.exists(data["file_path"])

    def test_tc_intg_003_tts_voices_integration(self):
        """TC-INTG-003: /tts/voices 엔드포인트 정상 동작"""
        pytest.skip("Server implementation not ready")

        # TODO: After server.py implementation
        # response = client.get("/tts/voices")
        #
        # assert response.status_code == 200
        # data = response.json()
        # assert "voices" in data
        # assert len(data["voices"]) > 0


# ============================================================
# 6. 경계값 테스트
# ============================================================


class TestBoundaryConditions:
    """경계값 테스트 (TC-BOUND-001 ~ 008)"""

    @pytest.mark.asyncio
    async def test_tc_bound_001_empty_text(self):
        """TC-BOUND-001: 빈 텍스트 TTS 요청"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider()

        import tempfile

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_empty.mp3")

        result = await provider.synthesize_async(
            text="", output_path=output_path
        )

        # 검증: 실패 예상
        assert result["success"] is False
        assert "empty" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_tc_bound_002_10000_chars_text(self):
        """TC-BOUND-002: 10,000자 텍스트 TTS"""
        pytest.skip("Long-running test - enable manually")

        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider()

        long_text = "A" * 10000

        import tempfile

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_long.mp3")

        import time

        start = time.time()
        result = await provider.synthesize_async(
            text=long_text, output_path=output_path
        )
        elapsed = time.time() - start

        # 검증
        assert result["success"] is True
        assert result["duration"] > 0
        assert elapsed < 60  # 60초 이내

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

    @pytest.mark.asyncio
    async def test_tc_bound_004_single_char_text(self):
        """TC-BOUND-004: 1자 텍스트 TTS"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider()

        import tempfile

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_single.mp3")

        result = await provider.synthesize_async(
            text="A", output_path=output_path
        )

        # 검증
        assert result["success"] is True
        assert result["duration"] > 0

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

    @pytest.mark.asyncio
    async def test_tc_bound_005_invalid_voice_id(self):
        """TC-BOUND-005: 잘못된 음성 ID"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider()

        import tempfile

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_invalid_voice.mp3")

        result = await provider.synthesize_async(
            text="Test", output_path=output_path, voice_id="invalid-voice-999"
        )

        # 검증: 실패 예상
        assert result["success"] is False
        assert "voice" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_tc_bound_007_special_characters(self):
        """TC-BOUND-007: 특수 문자 포함 텍스트 TTS"""
        from tts.edge_provider import EdgeTTSProvider

        provider = EdgeTTSProvider()

        special_text = "Hello! How are you? I'm fine. #test @user $10"

        import tempfile

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_special.mp3")

        result = await provider.synthesize_async(
            text=special_text, output_path=output_path
        )

        # 검증: 특수 문자가 안전하게 처리됨
        assert result["success"] is True
        assert result["duration"] > 0

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)


# ============================================================
# 7. 에러 케이스
# ============================================================


class TestErrorCases:
    """에러 케이스 테스트 (TC-ERROR-001 ~ 004)"""

    def test_tc_error_001_supertonic_api_key_validation(self):
        """TC-ERROR-001: Supertonic API 키 검증 실패"""
        from tts.supertonic_provider import SupertonicTTSProvider

        # 빈 API 키로 초기화 시도
        with pytest.raises(ValueError, match="Invalid.*API.*KEY"):
            SupertonicTTSProvider(api_key="")

        # "your_api_key_here" 같은 플레이스홀더 검증
        with pytest.raises(ValueError, match="Invalid.*API.*KEY"):
            SupertonicTTSProvider(api_key="your_api_key_here")

    @pytest.mark.asyncio
    async def test_tc_error_004_network_retry_failure(self):
        """TC-ERROR-004: 네트워크 재시도 실패 (Supertonic)"""
        pytest.skip("Retry logic not implemented yet")

        from tts.supertonic_provider import SupertonicTTSProvider

        provider = SupertonicTTSProvider(api_key="test_key")

        # httpx.AsyncClient.post Mock (네트워크 에러)
        with patch.object(provider.client, "post") as mock_post:
            import httpx

            # 3회 모두 실패
            mock_post.side_effect = httpx.NetworkError("Connection failed")

            import tempfile

            temp_dir = tempfile.gettempdir()
            output_path = os.path.join(temp_dir, "test.mp3")

            result = await provider.synthesize_async(
                text="Test", output_path=output_path
            )

            # 검증: 재시도 후 실패
            assert result["success"] is False
            assert "network" in result["error"].lower()

            # 3회 재시도 확인
            assert mock_post.call_count == 3


# ============================================================
# Pytest 실행 정보
# ============================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-m", "not performance"])
