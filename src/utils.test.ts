import { describe, it, expect } from 'vitest';
import { escapeQuestion, buildCommand } from './utils';

describe('escapeQuestion', () => {
  it('should escape double quotes', () => {
    const input = 'Say "hello"';
    const result = escapeQuestion(input);
    expect(result).toBe('Say \\"hello\\"');
  });

  it('should return same string if no quotes', () => {
    const input = 'Hello world';
    const result = escapeQuestion(input);
    expect(result).toBe('Hello world');
  });
});

describe('buildCommand', () => {
  it('should build command with default model', () => {
    const result = buildCommand('Hello');
    expect(result).toBe('claude -p "Hello" --model haiku');
  });

  it('should build command with custom model', () => {
    const result = buildCommand('Hello', 'sonnet');
    expect(result).toBe('claude -p "Hello" --model sonnet');
  });
});
