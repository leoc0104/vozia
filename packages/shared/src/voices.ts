export interface StockVoice {
  /** ElevenLabs premade voice id. */
  id: string
  name: string
  description: string
}

export const STOCK_VOICES: readonly StockVoice[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, young female narrator' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Soft, young female' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Emotional, young female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, confident female' },
  { id: 'ErXwobaYiN019PkbXTGH', name: 'Antoni', description: 'Well-rounded, young male' },
  { id: 'TxGEqnHdrfWFNfa2ZbVw', name: 'Josh', description: 'Deep, young male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp, middle-aged male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, middle-aged male narrator' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Raspy, young male' },
]

const ids = new Set(STOCK_VOICES.map((v) => v.id))

export function isStockVoiceId(id: string): boolean {
  return ids.has(id)
}
