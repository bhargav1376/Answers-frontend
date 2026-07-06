export function formatQuestionLabel(number, text) {
  const cleaned = (text || '')
    .replace(/— fill in the blank/gi, '')
    .replace(/fill in the blank/gi, '')
    .replace(/^Question\s+\d+\s*[-—]?\s*/i, '')
    .trim();
  return cleaned ? `Q${number} — ${cleaned}` : `Q${number} — Option & explanation`;
}

export function formatAiResponseTitle(item) {
  if (item.response_index > 1) {
    return `AI response ${item.response_index} for Q${item.question_number} by ${item.user_name}`;
  }
  return `AI response for Q${item.question_number} by ${item.user_name}`;
}

export function parseAiResponse(raw) {
  const text = (raw || '').trim();
  const answerMatch =
    text.match(/ANSWER:\s*([\s\S]*?)(?=EXPLANATION:|$)/i) ||
    text.match(/OPTION:\s*([\s\S]*?)(?=EXPLANATION:|$)/i);
  const explainMatch = text.match(/EXPLANATION:\s*([\s\S]*?)$/i);
  return {
    ai_option: answerMatch ? answerMatch[1].trim() : '',
    ai_explanation: explainMatch ? explainMatch[1].trim() : text,
    raw_response: text,
  };
}
