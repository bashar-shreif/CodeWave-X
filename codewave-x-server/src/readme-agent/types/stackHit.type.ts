export type StackHit = {
  stack: string;
  root: string;
  score: number;
  reasons: string[];
  confidence: 'low' | 'medium' | 'high';
};