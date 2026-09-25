import { fmtNss, fmtPct } from "@/lib/sentiment"
import type { AnalysisResult, AspectMetric } from "@/types/api"

export interface Recommendation {
  headline: string
  posture: string
  drivers: string[]
  actions: string[]
  caveats: string[]
}

function worstAspect(aspects: AspectMetric[]): AspectMetric | null {
  return aspects.filter((a) => a.mentions >= 3).sort((a, b) => a.nss - b.nss)[0] ?? null
}

function bestAspect(aspects: AspectMetric[]): AspectMetric | null {
  return aspects.filter((a) => a.mentions >= 3).sort((a, b) => b.nss - a.nss)[0] ?? null
}

export function buildRecommendation(r: AnalysisResult): Recommendation {
  const s = r.summary
  const worst = worstAspect(r.aspects)
  const best = bestAspect(r.aspects)
  const drivers: string[] = []
  const actions: string[] = []
  const caveats: string[] = []

  let headline: string
  let posture: string
  switch (s.nss_band) {
    case "critical":
      headline = "Reputation risk detected — response recommended"
      posture = `Net Sentiment Score of ${fmtNss(s.nss)} means negative voices outnumber positive ones by ${Math.abs(s.nss).toFixed(0)} points across ${r.analyzed} posts.`
      break
    case "neutral":
      headline = "Balanced perception — reinforce and monitor"
      posture = `Net Sentiment Score of ${fmtNss(s.nss)} indicates no dominant consensus; the conversation can tip either way.`
      break
    default:
      headline = "Strong positive consensus — amplify momentum"
      posture = `Net Sentiment Score of ${fmtNss(s.nss)} shows clear approval, with ${fmtPct(s.percentages.positive)} of posts positive.`
  }

  if (worst && worst.negative_pct >= 40) {
    drivers.push(`Negative discussion concentrates on "${worst.display}": ${fmtPct(worst.negative_pct, 0)} of its ${worst.mentions} mentions are negative (NSS ${fmtNss(worst.nss)}).`)
    actions.push(`Prepare a factual response addressing "${worst.display}" and brief spokespeople before the topic spreads further.`)
  }
  if (best && best.positive_pct >= 30 && best !== worst) {
    drivers.push(`"${best.display}" is the strongest positive theme (${fmtPct(best.positive_pct, 0)} positive across ${best.mentions} mentions).`)
    actions.push(`Amplify "${best.display}" in owned channels — it is the message the audience already endorses.`)
  }
  if (s.percentages.neutral >= 50) {
    drivers.push(`${fmtPct(s.percentages.neutral, 0)} of posts are neutral — a large share of the audience is informational rather than opinionated.`)
    actions.push("Publish clear, shareable explainers; neutral audiences convert on facts rather than persuasion.")
  }
  if (s.nss_band === "critical") {
    actions.push("Re-run this analysis in 24 hours with Compare Periods to confirm whether the negative trend is accelerating or fading.")
  } else if (s.nss_band === "strong_positive") {
    actions.push("Capture top positive quotes from the evidence feed for testimonials and social proof.")
  } else {
    actions.push("Set a weekly Compare Periods check so a directional shift is caught within days.")
  }

  const lowShare = r.analyzed ? r.low_confidence_count / r.analyzed : 0
  if (s.mean_confidence < 0.6 || lowShare > 0.15) {
    caveats.push(`Model certainty is moderate (mean confidence ${fmtPct(s.mean_confidence * 100, 0)}; ${r.low_confidence_count} posts below the ${r.confidence_floor} floor were counted as neutral). Treat the score as directional.`)
  }
  if (r.analyzed < 100) {
    caveats.push(`Sample of ${r.analyzed} posts is small — each post shifts the NSS by about ${(200 / r.analyzed).toFixed(1)} points.`)
  }
  if (r.oldest && r.newest) {
    const hours = (new Date(r.newest).getTime() - new Date(r.oldest).getTime()) / 3_600_000
    if (hours < 6) caveats.push(`All posts fall within ${hours < 1 ? "under an hour" : `${hours.toFixed(0)} hours`} — this is a snapshot of the current news cycle, not a long-run view.`)
  }
  caveats.push("Sarcasm and irony remain the model's known weak spot; review low-confidence quotes before acting on individual posts.")

  return { headline, posture, drivers, actions: actions.slice(0, 4), caveats }
}