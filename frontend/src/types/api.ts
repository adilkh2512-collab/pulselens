export type SentimentLabel = "positive" | "neutral" | "negative"
export type NssBand = "strong_positive" | "neutral" | "critical"
export type SortOrder = "latest" | "top"
export type Granularity = "quarter_hour" | "hour" | "day" | "week"
export type RunStage =
  | "queued" | "fetching" | "cleaning" | "loading_model" | "analyzing"
  | "extracting_aspects" | "aggregating" | "saving" | "done" | "failed"

export interface AnalyzeRequest {
  query: string
  sample_size: number
  since?: string | null
  until?: string | null
  lang?: string | null
  sort: SortOrder
  force?: boolean
}

export interface RunAccepted {
  run_id: string
  status: RunStage
  cached: boolean
}

export interface AnalyzedPost {
  post_id: string
  url: string
  author_handle: string
  author_name: string
  created_at: string
  text: string
  clean_text: string
  likes: number
  replies: number
  reposts: number
  quotes: number
  label: SentimentLabel
  effective_label: SentimentLabel
  low_confidence: boolean
  score: number
  confidence: number
  p_positive: number
  p_neutral: number
  p_negative: number
  aspects: string[]
}

export interface SentimentSummary {
  total: number
  counts: Record<SentimentLabel, number>
  raw_counts: Record<SentimentLabel, number>
  percentages: Record<SentimentLabel, number>
  nss: number
  nss_band: NssBand
  mean_confidence: number
  mean_score: number
}

export interface AspectMetric {
  aspect: string
  display: string
  mentions: number
  positive: number
  neutral: number
  negative: number
  positive_pct: number
  neutral_pct: number
  negative_pct: number
  nss: number
  mean_score: number
  sample_post_ids: string[]
}

export interface TimelineBucket {
  bucket_start: string
  count: number
  positive: number
  neutral: number
  negative: number
  positive_pct: number
  neutral_pct: number
  negative_pct: number
  mean_score: number
}

export interface Timeline {
  granularity: Granularity | null
  buckets: TimelineBucket[]
}

export interface AnalysisResult {
  run_id: string
  query: string
  requested: number
  fetched: number
  analyzed: number
  dropped: Record<string, number>
  low_confidence_count: number
  confidence_floor: number
  pages_fetched: number
  hits_total: number | null
  since: string | null
  until: string | null
  lang: string | null
  sort: SortOrder
  oldest: string | null
  newest: string | null
  model: string
  started_at: string
  duration_seconds: number
  summary: SentimentSummary
  aspects: AspectMetric[]
  timeline: Timeline
  posts: AnalyzedPost[]
}

export interface RunStatus {
  run_id: string
  status: RunStage
  stage_current: number
  stage_total: number
  progress_pct: number
  message: string
  cached: boolean
  error: string | null
  result: AnalysisResult | null
}

export interface HistoryItem {
  run_id: string
  query: string
  sample_size: number
  analyzed: number
  since: string | null
  until: string | null
  sort: SortOrder
  nss: number
  nss_band: NssBand
  positive: number
  neutral: number
  negative: number
  mean_confidence: number
  duration_seconds: number
  created_at: string
}

export interface HistoryResponse {
  items: HistoryItem[]
  total: number
  limit: number
  offset: number
}

export interface Health {
  status: string
  handle: string
  sentiment_model: string
  model_loaded: boolean
  batch_size: number
  max_sample_size: number
  confidence_floor: number
  runs_stored: number
}

export type CompareStage = "queued" | "running" | "done" | "failed"
export type TrendDirection = "improving" | "worsening" | "stable"

export interface ComparePeriodInput {
  label?: string
  since: string
  until: string
}

export interface CompareRequest {
  query: string
  sample_size: number
  lang?: string | null
  sort: SortOrder
  periods: ComparePeriodInput[]
  force?: boolean
}

export interface CompareAccepted {
  compare_id: string
  status: CompareStage
}

export interface PeriodResult {
  label: string
  since: string
  until: string
  run_id: string
  fetched: number
  analyzed: number
  summary: SentimentSummary
  aspects: AspectMetric[]
  timeline: Timeline
}

export interface PeriodDelta {
  from_label: string
  to_label: string
  nss_delta: number
  positive_pct_delta: number
  neutral_pct_delta: number
  negative_pct_delta: number
  volume_delta: number
  direction: TrendDirection
}

export interface AspectShift {
  aspect: string
  display: string
  nss: (number | null)[]
  mentions: number[]
}

export interface CompareResult {
  compare_id: string
  query: string
  sample_size: number
  lang: string | null
  sort: SortOrder
  created_at: string
  duration_seconds: number
  periods: PeriodResult[]
  deltas: PeriodDelta[]
  trend: TrendDirection
  aspect_shift: AspectShift[]
}

export interface CompareStatus {
  compare_id: string
  status: CompareStage
  progress_pct: number
  message: string
  current_period: number
  total_periods: number
  error: string | null
  result: CompareResult | null
}

export interface CompareHistoryItem {
  compare_id: string
  query: string
  sample_size: number
  period_count: number
  trend: TrendDirection
  first_nss: number
  last_nss: number
  duration_seconds: number
  created_at: string
}

export interface CompareHistoryResponse {
  items: CompareHistoryItem[]
  total: number
  limit: number
  offset: number
}