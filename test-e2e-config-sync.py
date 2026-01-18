#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2E 테스트 스크립트 - 설정 동기화 (KAN-22)
ConfigManager 우선순위 및 /config/update API 검증
"""

import requests
import json
import time
import sys
import io
from datetime import datetime

# Windows 콘솔 UTF-8 출력 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 테스트 결과
test_results = []
total_tests = 0
passed_tests = 0
failed_tests = 0
skipped_tests = 0

# 서버 URL
BASE_URL = "http://localhost:8000"

def log_test(test_id, name, status, reason=""):
    """테스트 결과 기록"""
    global total_tests, passed_tests, failed_tests, skipped_tests

    total_tests += 1
    result = {
        "test_id": test_id,
        "name": name,
        "status": status,
        "timestamp": datetime.now().isoformat(),
        "reason": reason
    }
    test_results.append(result)

    if status == "Pass":
        passed_tests += 1
        print(f"✅ {test_id}: {name} - PASS")
    elif status == "Fail":
        failed_tests += 1
        print(f"❌ {test_id}: {name} - FAIL")
        if reason:
            print(f"   Reason: {reason}")
    elif status == "Skip":
        skipped_tests += 1
        print(f"⏭️  {test_id}: {name} - SKIP")
        if reason:
            print(f"   Reason: {reason}")


def test_qa_034():
    """QA-034: ConfigManager 초기 상태 확인"""
    test_id = "QA-034"
    name = "ConfigManager 초기 상태 확인"

    try:
        # Health check로 현재 TTS Provider 확인
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"Health check failed: {response.status_code}")
            return

        health_data = response.json()

        # TTS Provider가 로드되어 있는지 확인
        if not health_data.get("tts_loaded"):
            log_test(test_id, name, "Fail", "TTS not loaded")
            return

        # Provider 타입 확인 (supertonic 또는 edge-tts)
        provider = health_data.get("tts_provider")
        if provider not in ["supertonic", "edge-tts"]:
            log_test(test_id, name, "Fail", f"Invalid TTS provider: {provider}")
            return

        log_test(test_id, name, "Pass", f"Current TTS provider: {provider}")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_035():
    """QA-035: /config/update API 기본 동작"""
    test_id = "QA-035"
    name = "/config/update API 기본 동작"

    try:
        # Edge TTS로 변경
        config_request = {
            "ttsProvider": "edge-tts"
        }

        response = requests.post(
            f"{BASE_URL}/config/update",
            json=config_request,
            timeout=10
        )

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"API failed: {response.status_code}")
            return

        result = response.json()

        # 응답 구조 검증
        if not result.get("success"):
            log_test(test_id, name, "Fail", f"Update failed: {result.get('error')}")
            return

        if "applied_config" not in result:
            log_test(test_id, name, "Fail", "Missing applied_config in response")
            return

        # ConfigManager에 TTS_PROVIDER가 업데이트되었는지 확인
        applied = result["applied_config"]
        if applied.get("TTS_PROVIDER") != "edge-tts":
            log_test(test_id, name, "Fail", f"Config not applied: {applied}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_036():
    """QA-036: TTS Provider 재생성 확인"""
    test_id = "QA-036"
    name = "TTS Provider 재생성 확인"

    try:
        # 1. Supertonic으로 변경
        config_request = {"ttsProvider": "supertonic"}
        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"Config update failed: {response.status_code}")
            return

        # 2. Health check로 Provider 변경 확인
        time.sleep(0.5)  # Provider 재생성 대기
        response = requests.get(f"{BASE_URL}/health", timeout=5)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Health check failed")
            return

        health_data = response.json()
        if health_data.get("tts_provider") != "supertonic":
            log_test(test_id, name, "Fail", f"Provider not changed: {health_data.get('tts_provider')}")
            return

        # 3. TTS 생성 테스트
        tts_request = {"text": "Test", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=30)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"TTS synthesis failed: {response.status_code}")
            return

        result = response.json()
        if result.get("provider") != "supertonic":
            log_test(test_id, name, "Fail", f"Wrong provider in TTS result: {result.get('provider')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_037():
    """QA-037: 잘못된 Provider 타입 에러 처리"""
    test_id = "QA-037"
    name = "잘못된 Provider 타입 에러 처리"

    try:
        # 잘못된 provider 타입 전송
        config_request = {"ttsProvider": "invalid-provider"}
        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        # 400 에러 확인
        if response.status_code != 400:
            log_test(test_id, name, "Fail", f"Expected 400, got {response.status_code}")
            return

        result = response.json()
        if result.get("success") != False:
            log_test(test_id, name, "Fail", "Should return success: false")
            return

        if "error" not in result:
            log_test(test_id, name, "Fail", "Missing error message")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_038():
    """QA-038: camelCase → UPPER_SNAKE_CASE 변환"""
    test_id = "QA-038"
    name = "camelCase → UPPER_SNAKE_CASE 변환"

    try:
        # camelCase 키로 여러 설정 전송
        config_request = {
            "ttsProvider": "edge-tts",
            "ttsVoice": "en-US-JennyNeural",
            "sttUseGpu": True
        }

        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"API failed: {response.status_code}")
            return

        result = response.json()
        applied = result.get("applied_config", {})

        # UPPER_SNAKE_CASE로 변환되었는지 확인
        expected_keys = ["TTS_PROVIDER", "TTS_VOICE", "STT_USE_GPU"]
        for key in expected_keys:
            if key not in applied:
                log_test(test_id, name, "Fail", f"Missing key: {key}")
                return

        # 값 확인
        if applied["TTS_PROVIDER"] != "edge-tts":
            log_test(test_id, name, "Fail", f"Wrong TTS_PROVIDER: {applied['TTS_PROVIDER']}")
            return

        if applied["TTS_VOICE"] != "en-US-JennyNeural":
            log_test(test_id, name, "Fail", f"Wrong TTS_VOICE: {applied['TTS_VOICE']}")
            return

        if applied["STT_USE_GPU"] != True:
            log_test(test_id, name, "Fail", f"Wrong STT_USE_GPU: {applied['STT_USE_GPU']}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_039():
    """QA-039: 설정 우선순위 (Electron > .env)"""
    test_id = "QA-039"
    name = "설정 우선순위 (Electron > .env)"

    try:
        # Electron 설정으로 edge-tts 설정
        config_request = {"ttsProvider": "edge-tts"}
        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        # Health check로 Provider 확인 (Electron 설정이 우선)
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        health_data = response.json()

        # .env의 TTS_PROVIDER가 supertonic이어도, Electron 설정이 우선
        if health_data.get("tts_provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Priority not working: {health_data.get('tts_provider')}")
            return

        log_test(test_id, name, "Pass", "Electron config takes priority over .env")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_040():
    """QA-040: None 값 무시"""
    test_id = "QA-040"
    name = "None 값 무시"

    try:
        # None 값 포함 요청
        config_request = {
            "ttsProvider": "supertonic",
            "ttsVoice": None,
            "sttUseGpu": False
        }

        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        result = response.json()
        applied = result.get("applied_config", {})

        # None 값은 ConfigManager에 저장되지 않아야 함
        if "TTS_VOICE" in applied and applied["TTS_VOICE"] is None:
            log_test(test_id, name, "Fail", "None value should be ignored")
            return

        # TTS_PROVIDER와 STT_USE_GPU만 저장되어야 함
        if applied.get("TTS_PROVIDER") != "supertonic":
            log_test(test_id, name, "Fail", f"Wrong TTS_PROVIDER: {applied.get('TTS_PROVIDER')}")
            return

        if applied.get("STT_USE_GPU") != False:
            log_test(test_id, name, "Fail", f"Wrong STT_USE_GPU: {applied.get('STT_USE_GPU')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_041():
    """QA-041: 여러 설정 동시 업데이트"""
    test_id = "QA-041"
    name = "여러 설정 동시 업데이트"

    try:
        # 여러 설정 동시 업데이트
        config_request = {
            "ttsProvider": "edge-tts",
            "ttsVoice": "en-US-GuyNeural",
            "sttUseGpu": True
        }

        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        result = response.json()
        applied = result.get("applied_config", {})

        # 모든 설정이 적용되었는지 확인
        if applied.get("TTS_PROVIDER") != "edge-tts":
            log_test(test_id, name, "Fail", "TTS_PROVIDER not updated")
            return

        if applied.get("TTS_VOICE") != "en-US-GuyNeural":
            log_test(test_id, name, "Fail", "TTS_VOICE not updated")
            return

        if applied.get("STT_USE_GPU") != True:
            log_test(test_id, name, "Fail", "STT_USE_GPU not updated")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_042():
    """QA-042: Edge TTS Voice ID 적용"""
    test_id = "QA-042"
    name = "Edge TTS Voice ID 적용"

    try:
        # Edge TTS Voice 설정
        config_request = {
            "ttsProvider": "edge-tts",
            "ttsVoice": "en-US-AriaNeural"
        }

        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        # TTS 생성 테스트
        time.sleep(0.5)
        tts_request = {"text": "Hello", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=30)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"TTS synthesis failed: {response.status_code}")
            return

        result = response.json()

        # Voice ID가 설정에서 지정한 값인지 확인
        if result.get("voice_id") != "en-US-AriaNeural":
            log_test(test_id, name, "Fail", f"Wrong voice_id: {result.get('voice_id')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_043():
    """QA-043: Supertonic Voice ID 적용"""
    test_id = "QA-043"
    name = "Supertonic Voice ID 적용"

    try:
        # Supertonic Voice 설정
        config_request = {
            "ttsProvider": "supertonic",
            "supertonicVoice": "M3"
        }

        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        # TTS 생성 테스트
        time.sleep(0.5)
        tts_request = {"text": "Test", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=30)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"TTS synthesis failed: {response.status_code}")
            return

        result = response.json()

        # Voice ID가 설정에서 지정한 값인지 확인
        if result.get("voice_id") != "M3":
            log_test(test_id, name, "Fail", f"Wrong voice_id: {result.get('voice_id')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_044():
    """QA-044: 기존 TTS/STT 기능 영향 없음 (Regression)"""
    test_id = "QA-044"
    name = "기존 TTS/STT 기능 영향 없음 (Regression)"

    try:
        # Edge TTS 설정
        config_request = {"ttsProvider": "edge-tts"}
        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        time.sleep(0.5)

        # TTS 기능 테스트
        tts_request = {"text": "Regression test", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=30)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "TTS functionality broken")
            return

        result = response.json()
        required_fields = ["success", "file_path", "duration", "voice_id", "provider"]
        for field in required_fields:
            if field not in result:
                log_test(test_id, name, "Fail", f"Missing field: {field}")
                return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_045():
    """QA-045: ConfigManager 상태 확인 (/health 응답)"""
    test_id = "QA-045"
    name = "ConfigManager 상태 확인 (/health 응답)"

    try:
        # Edge TTS로 설정 변경
        config_request = {"ttsProvider": "edge-tts"}
        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Config update failed")
            return

        time.sleep(0.5)

        # Health check로 설정 확인
        response = requests.get(f"{BASE_URL}/health", timeout=5)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Health check failed")
            return

        health_data = response.json()

        # TTS Provider가 변경되었는지 확인
        if health_data.get("tts_provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Provider not updated: {health_data.get('tts_provider')}")
            return

        if health_data.get("tts_provider_type") != "edge-tts":
            log_test(test_id, name, "Fail", f"Provider type not updated: {health_data.get('tts_provider_type')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_046():
    """QA-046: 빈 요청 처리"""
    test_id = "QA-046"
    name = "빈 요청 처리"

    try:
        # 빈 요청 전송
        config_request = {}
        response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)

        # 200 OK 응답이어야 함 (빈 요청도 유효)
        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"Expected 200, got {response.status_code}")
            return

        result = response.json()
        if not result.get("success"):
            log_test(test_id, name, "Fail", "Should return success: true")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def test_qa_047():
    """QA-047: 서버 재시작 후 설정 복원 (.env 우선순위)"""
    test_id = "QA-047"
    name = "서버 재시작 후 설정 복원 (.env 우선순위)"

    # 서버 재시작이 필요하므로 Skip
    log_test(test_id, name, "Skip", "Requires server restart")


def test_qa_048():
    """QA-048: 동시 요청 처리 (Race Condition)"""
    test_id = "QA-048"
    name = "동시 요청 처리 (Race Condition)"

    try:
        import threading

        results = []
        errors = []

        def send_config(provider):
            try:
                config_request = {"ttsProvider": provider}
                response = requests.post(f"{BASE_URL}/config/update", json=config_request, timeout=10)
                results.append(response.json())
            except Exception as e:
                errors.append(str(e))

        # 2개의 동시 요청 (edge-tts, supertonic)
        threads = [
            threading.Thread(target=send_config, args=("edge-tts",)),
            threading.Thread(target=send_config, args=("supertonic",))
        ]

        for t in threads:
            t.start()

        for t in threads:
            t.join()

        # 에러가 없어야 함
        if errors:
            log_test(test_id, name, "Fail", f"Errors: {errors}")
            return

        # 모든 요청이 성공해야 함
        if len(results) != 2:
            log_test(test_id, name, "Fail", f"Expected 2 results, got {len(results)}")
            return

        for result in results:
            if not result.get("success"):
                log_test(test_id, name, "Fail", f"Request failed: {result}")
                return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))


def main():
    """메인 테스트 실행"""
    print("\n" + "="*60)
    print("E2E 테스트 시작 - 설정 동기화 (KAN-22)")
    print("="*60 + "\n")

    # 서버 연결 확인
    print("서버 연결 확인 중...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ 서버 연결 성공: {BASE_URL}\n")
        else:
            print(f"❌ 서버 응답 에러: {response.status_code}")
            print("테스트를 중단합니다.")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"❌ 서버에 연결할 수 없습니다: {BASE_URL}")
        print("Python 백엔드 서버를 먼저 실행하세요: python python-backend/server.py")
        sys.exit(1)

    # ConfigManager 시나리오 테스트
    print("ConfigManager 시나리오 테스트 (QA-034 ~ QA-048)")
    print("-" * 60)
    test_qa_034()
    test_qa_035()
    test_qa_036()
    test_qa_037()
    test_qa_038()
    test_qa_039()
    test_qa_040()
    test_qa_041()
    test_qa_042()
    test_qa_043()
    test_qa_044()
    test_qa_045()
    test_qa_046()
    test_qa_047()
    test_qa_048()

    # 결과 요약
    print("\n" + "="*60)
    print("테스트 결과 요약")
    print("="*60)
    print(f"총 시나리오: {total_tests}개")
    print(f"Pass: {passed_tests}개")
    print(f"Fail: {failed_tests}개")
    print(f"Skip: {skipped_tests}개")
    print(f"성공률: {(passed_tests/total_tests*100):.1f}%")
    print("="*60 + "\n")

    # JSON 결과 저장
    output = {
        "totalScenarios": total_tests,
        "passed": passed_tests,
        "failed": failed_tests,
        "skipped": skipped_tests,
        "timestamp": datetime.now().isoformat(),
        "results": test_results
    }

    output_path = "E:\\develop\\electron-test-worktrees\\feature-KAN-22-settings-sync\\e2e-test-results-config-sync.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"테스트 결과 저장됨: {output_path}\n")

    # 실패한 테스트가 있으면 exit code 1
    if failed_tests > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
