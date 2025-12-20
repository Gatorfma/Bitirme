/**
 * RAG Types
 * Type definitions for in-memory RAG implementation
 */

export type PsychologyItem = {
  id: string;
  prompt: string;
  response: string;
};

export type RagDoc = {
  id: string;
  text: string;
};

export type RagHit = {
  id: string;
  text: string;
  score: number;
};

