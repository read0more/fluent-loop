# TTS Provider 테스트 가이드

## 개요

TTS Provider 추상화 및 Supertonic TTS 통합을 위한 TDD(Test-Driven Development) 테스트 코드입니다.

**현재 단계**: Red Phase (테스트가 실패하도록 먼저 작성)

## 테스트 파일 구조

```
tests/
├── test_tts_provider.py    # TTS Provider 추상화 테스트 (신규)
└── test_tts.py             # 기존 TTS 테스트
```

## 테스트 통계

- **총 테스트**: 28개
- **단위 테스트**: 20개
  - ITTSProvider: 2개
  - EdgeTTSProvider: 4개
  - SupertonicTTSProvider: 5개
  - TTSProviderFactory: 5개
  - 기타 단위 테스트: 4개
- **통합 테스트**: 3개
- **경계값 테스트**: 5개
- **에러 케이스**: 2개

## 설치

### 필수 의존성 설치

```bash
cd python-backend
pip install -r requirements.txt
```

### 테스트 의존성 설치

```bash
pip install pytest pytest-asyncio pytest-mock pytest-cov
```

## 테스트 실행

### 전체 테스트 실행

```bash
# 모든 테스트 실행
pytest tests/ -v

# 특정 파일만 실행
pytest tests/test_tts_provider.py -v

# 상세한 출력
pytest tests/test_tts_provider.py -vv --tb=long
```

### 테스트 필터링

```bash
# 단위 테스트만 실행
pytest tests/test_tts_provider.py::TestEdgeTTSProvider -v

# 특정 테스트만 실행
pytest tests/test_tts_provider.py::TestEdgeTTSProvider::test_tc_unit_002_initialization -v

# 성능 테스트 제외
pytest tests/ -v -m "not performance"
```

### 커버리지 측정

```bash
# HTML 리포트 생성
pytest tests/ --cov=tts --cov-report=html

# 터미널 출력
pytest tests/ --cov=tts --cov-report=term-missing
```

## TDD 프로세스

### 1. Red Phase (현재 단계)

테스트를 먼저 작성합니다. 구현이 없으므로 모든 테스트가 실패합니다.

```bash
pytest tests/test_tts_provider.py -v
# Expected: All tests should fail with ImportError
```

### 2. Green Phase (다음 단계)

최소한의 코드를 작성하여 테스트를 통과시킵니다.

**구현할 파일**:
- `python-backend/tts/__init__.py`
- `python-backend/tts/base.py` (ITTSProvider)
- `python-backend/tts/edge_provider.py` (EdgeTTSProvider)
- `python-backend/tts/supertonic_provider.py` (SupertonicTTSProvider)
- `python-backend/tts/factory.py` (TTSProviderFactory)

### 3. Refactor Phase

테스트 통과 후 코드를 개선합니다.

## 테스트 케이스 매핑

### TC-UNIT-001: ITTSProvider 추상 클래스

- `test_cannot_instantiate_abstract_class`: 직접 인스턴스화 불가
- `test_must_implement_all_abstract_methods`: 추상 메서드 구현 필수

### TC-UNIT-002 ~ 005: EdgeTTSProvider

- `test_tc_unit_002_initialization`: 초기화
- `test_tc_unit_003_synthesize_async_success`: 음성 합성 성공
- `test_tc_unit_004_get_available_voices_async`: 음성 목록 조회
- `test_tc_unit_005_get_provider_info`: 프로바이더 정보

### TC-UNIT-006 ~ 010: SupertonicTTSProvider

- `test_tc_unit_006_initialization`: 초기화
- `test_tc_unit_007_synthesize_async_success_mock`: 음성 합성 (Mock)
- `test_tc_unit_008_synthesize_async_auth_failure`: 인증 실패 (401)
- `test_tc_unit_009_get_available_voices_async_mock`: 음성 목록 (Mock)
- `test_tc_unit_010_get_default_voices_on_api_failure`: Fallback 음성

### TC-UNIT-011 ~ 015: TTSProviderFactory

- `test_tc_unit_011_create_edge_tts_provider`: EdgeTTS 생성
- `test_tc_unit_012_create_supertonic_provider`: Supertonic 생성
- `test_tc_unit_013_create_provider_missing_api_key`: API 키 누락
- `test_tc_unit_014_create_provider_unknown_type`: 지원하지 않는 타입
- `test_tc_unit_015_create_provider_default`: 기본값

### TC-INTG-001 ~ 003: FastAPI 통합

- `test_tc_intg_001_health_check_with_tts_provider`: /health 엔드포인트
- `test_tc_intg_002_tts_synthesize_integration`: /tts/synthesize 엔드포인트
- `test_tc_intg_003_tts_voices_integration`: /tts/voices 엔드포인트

### TC-BOUND-001 ~ 008: 경계값

- `test_tc_bound_001_empty_text`: 빈 텍스트
- `test_tc_bound_002_10000_chars_text`: 10,000자 텍스트
- `test_tc_bound_004_single_char_text`: 1자 텍스트
- `test_tc_bound_005_invalid_voice_id`: 잘못된 음성 ID
- `test_tc_bound_007_special_characters`: 특수 문자

### TC-ERROR-001 ~ 004: 에러 케이스

- `test_tc_error_001_supertonic_api_key_validation`: API 키 검증
- `test_tc_error_004_network_retry_failure`: 네트워크 재시도

## 커버리지 목표

| 모듈 | 목표 커버리지 | 우선순위 |
|------|---------------|----------|
| ITTSProvider (base.py) | 100% | HIGH |
| EdgeTTSProvider | 90% | HIGH |
| SupertonicTTSProvider | 85% | HIGH |
| TTSProviderFactory | 100% | HIGH |

## 환경 변수 테스트

테스트에서 사용하는 환경 변수는 `pytest`의 `monkeypatch` fixture를 사용하여 격리합니다.

```python
def test_example(monkeypatch):
    monkeypatch.setenv("TTS_PROVIDER", "edge-tts")
    # 테스트 코드
```

## Mock 전략

### httpx.AsyncClient Mock

Supertonic TTS API 호출은 `unittest.mock`을 사용하여 Mock합니다.

```python
with patch.object(provider.client, 'post') as mock_post:
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.content = b"fake_mp3_data"
    mock_post.return_value = mock_response
```

## 트러블슈팅

### pytest를 찾을 수 없음

```bash
pip install pytest pytest-asyncio pytest-mock
```

### httpx 모듈 없음

```bash
pip install httpx
```

### 비동기 테스트 실행 안 됨

`pytest-asyncio` 설치 확인:
```bash
pip install pytest-asyncio
```

## 참고 문서

- **테스트 케이스 문서**: `claude.config/dev-workflow/docs/test-cases.md`
- **기술 사양서**: `.claude/claudedocs/tts-provider-spec.md`

## 다음 단계

1. 구현 시작 (Green Phase)
2. 테스트 실행하여 통과 확인
3. 코드 리팩토링 (Refactor Phase)
4. 커버리지 측정 및 개선

---

**작성일**: 2026-01-15
**테스트 프레임워크**: pytest + pytest-asyncio + pytest-mock
**TDD Phase**: Red (테스트 먼저 작성)
