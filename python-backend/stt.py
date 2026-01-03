import whisper
import torch
import os
from typing import Optional

class WhisperSTT:
    def __init__(self, model_size: str = "base", use_gpu: bool = False):
        """
        Whisper STT 서비스 초기화

        Args:
            model_size: Whisper 모델 크기 (tiny, base, small, medium, large)
            use_gpu: GPU 사용 여부
        """
        self.model_size = model_size
        self.device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"

        print(f"Loading Whisper model '{model_size}' on {self.device}...")
        self.model = whisper.load_model(model_size, device=self.device)
        print("Whisper model loaded successfully")

    def transcribe(self, audio_path: str, language: str = "ko") -> dict:
        """
        오디오 파일을 텍스트로 변환

        Args:
            audio_path: 오디오 파일 경로
            language: 언어 코드 (ko, en 등)

        Returns:
            {
                "text": str,
                "language": str,
                "duration": float
            }
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Whisper 실행
        result = self.model.transcribe(
            audio_path,
            language=language,
            fp16=False  # CPU에서는 fp16 사용 안 함
        )

        return {
            "text": result["text"].strip(),
            "language": result["language"],
            "duration": result.get("duration", 0.0)
        }

    def get_model_info(self) -> dict:
        """모델 정보 반환"""
        return {
            "model_size": self.model_size,
            "device": self.device,
            "gpu_available": torch.cuda.is_available()
        }
