import type { DubStatus, Pipeline, SourceType, VoiceMode } from '@vozia/shared'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Row types are type aliases (not interfaces) so they satisfy supabase-js's Record<string, unknown> constraint.
type Timestamps = { created_at: string; updated_at: string }

export type ProfileRow = Timestamps & {
  id: string
  display_name: string | null
  avatar_url: string | null
  minutes_quota: number
  minutes_used: number
}

export type VideoRow = Timestamps & {
  id: string
  owner_id: string
  title: string
  source_type: SourceType
  source_url: string | null
  storage_path: string | null
  duration_seconds: number | null
  thumbnail_path: string | null
}

export type DubRow = Timestamps & {
  id: string
  video_id: string
  owner_id: string
  source_language: string | null
  target_language: string
  voice_mode: VoiceMode
  stock_voice_id: string | null
  pipeline: Pipeline | null
  status: DubStatus
  progress: number
  failed_stage: string | null
  error_message: string | null
  attempts: number
  provider_ref: string | null
  detected_language: string | null
  output_path: string | null
  dubbed_audio_path: string | null
  srt_original_path: string | null
  srt_translated_path: string | null
  started_at: string | null
  completed_at: string | null
}

export type DubSegmentRow = {
  id: number
  dub_id: string
  idx: number
  start_ms: number
  end_ms: number
  speaker: string | null
  text: string
  translated_text: string | null
}

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<Omit<ProfileRow, 'id'>> & { id: string }
        Update: Partial<ProfileRow>
        Relationships: Relationship[]
      }
      videos: {
        Row: VideoRow
        Insert: Partial<Omit<VideoRow, 'owner_id' | 'title' | 'source_type'>> & {
          owner_id: string
          title: string
          source_type: SourceType
        }
        Update: Partial<VideoRow>
        Relationships: Relationship[]
      }
      dubs: {
        Row: DubRow
        Insert: Partial<Omit<DubRow, 'video_id' | 'owner_id' | 'target_language'>> & {
          video_id: string
          owner_id: string
          target_language: string
        }
        Update: Partial<DubRow>
        Relationships: Relationship[]
      }
      dub_segments: {
        Row: DubSegmentRow
        Insert: Partial<Omit<DubSegmentRow, 'dub_id' | 'idx' | 'start_ms' | 'end_ms' | 'text'>> & {
          dub_id: string
          idx: number
          start_ms: number
          end_ms: number
          text: string
        }
        Update: Partial<DubSegmentRow>
        Relationships: Relationship[]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      retry_dub: { Args: { p_dub_id: string }; Returns: undefined }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
