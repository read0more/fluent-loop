export function escapeQuestion(question: string): string {
  return question.replace(/"/g, '\\"');
}

export function buildCommand(question: string, model: string = 'haiku'): string {
  const escapedQuestion = escapeQuestion(question);
  return `claude -p "${escapedQuestion}" --model ${model}`;
}
