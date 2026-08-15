import type {
  CoachingInsight,
  CoachingInsightSeverity,
  PromiseRiskMetrics,
  SupplierReliabilityEvaluation,
} from './types';

/**
 * Generates deterministic, evidence-backed coaching insights from evaluation data.
 * This is a pure rule engine — no LLM involvement.
 * Insights are ordered by descending severity (CRITICAL → WARN → INFO).
 */
export function generateCoachingInsights(
  evaluation: SupplierReliabilityEvaluation,
  promiseRisk: PromiseRiskMetrics | null
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  if (evaluation.status === 'INSUFFICIENT_DATA') {
    insights.push({
      code: 'INSUFFICIENT_HISTORY',
      severity: 'INFO',
      message: `Only ${evaluation.recent.evaluatedOrders} evaluated orders in the recent window. At least ${10} are required for reliable scoring. Continue importing outcome data.`,
      evidenceKeys: ['recent.evaluatedOrders'],
    });
    return insights;
  }

  // --- Trigger-based insights ---
  for (const trigger of evaluation.triggers) {
    const bpsToPercent = (bps: number) => (bps / 100).toFixed(1);
    const severity: CoachingInsightSeverity = trigger.severe ? 'CRITICAL' : 'WARN';

    switch (trigger.code) {
      case 'FILL_RATE_DROP':
        insights.push({
          code: 'FILL_RATE_DROP',
          severity,
          message: `Fill rate has fallen ${bpsToPercent(trigger.delta)} percentage points below the historical baseline (${bpsToPercent(trigger.baseline)}% → ${bpsToPercent(trigger.recent)}%). Investigate stock availability and allocation capacity.`,
          evidenceKeys: ['recent.fillRateBps', 'baseline.fillRateBps', 'triggers.FILL_RATE_DROP'],
        });
        break;

      case 'OTIF_DROP':
        insights.push({
          code: 'OTIF_DROP',
          severity,
          message: `On-time in-full (OTIF) rate dropped ${bpsToPercent(trigger.delta)} pts (${bpsToPercent(trigger.baseline)}% → ${bpsToPercent(trigger.recent)}%). Review logistics capacity and delivery commitment reliability.`,
          evidenceKeys: ['recent.otifRateBps', 'baseline.otifRateBps', 'triggers.OTIF_DROP'],
        });
        break;

      case 'CANCELLATION_INCREASE':
        insights.push({
          code: 'CANCELLATION_INCREASE',
          severity,
          message: `Cancellation rate increased ${bpsToPercent(trigger.delta)} pts above baseline (${bpsToPercent(trigger.baseline)}% → ${bpsToPercent(trigger.recent)}%). Escalate to supplier for root cause analysis.`,
          evidenceKeys: ['recent.cancellationRateBps', 'baseline.cancellationRateBps', 'triggers.CANCELLATION_INCREASE'],
        });
        break;

      case 'PARTIAL_FILL_INCREASE':
        insights.push({
          code: 'PARTIAL_FILL_INCREASE',
          severity,
          message: `Partial fulfillment rate increased ${bpsToPercent(trigger.delta)} pts (${bpsToPercent(trigger.baseline)}% → ${bpsToPercent(trigger.recent)}%). Supplier may be over-promising available stock.`,
          evidenceKeys: ['recent.partialFillRateBps', 'baseline.partialFillRateBps'],
        });
        break;

      case 'LEAD_TIME_P95_DETERIORATION': {
        const recentHours = Math.round(trigger.recent / 60);
        const baselineHours = Math.round(trigger.baseline / 60);
        insights.push({
          code: 'LEAD_TIME_DETERIORATION',
          severity,
          message: `P95 delivery lead time has grown from ${baselineHours}h to ${recentHours}h — a ${Math.round(trigger.delta / 60)}h increase. Review last-mile logistics and fulfilment priorities.`,
          evidenceKeys: ['recent.leadTimeP95Minutes', 'baseline.leadTimeP95Minutes'],
        });
        break;
      }
    }
  }

  // --- Promise risk insight ---
  if (promiseRisk && promiseRisk.promiseRiskLevel !== 'INSUFFICIENT_DATA') {
    const pct = promiseRisk.promiseHonouredBps !== null
      ? (promiseRisk.promiseHonouredBps / 100).toFixed(0)
      : '—';

    if (promiseRisk.promiseRiskLevel === 'HIGH') {
      insights.push({
        code: 'PROMISE_FIDELITY_HIGH_RISK',
        severity: 'CRITICAL',
        message: `Only ${pct}% of promised delivery dates were honoured (${promiseRisk.promiseHonouredCount} of ${promiseRisk.promiseGivenCount} orders). Promises are unreliable — procurement team should negotiate stricter SLAs.`,
        evidenceKeys: ['promiseRisk.promiseHonouredBps', 'promiseRisk.promiseGivenCount'],
      });
    } else if (promiseRisk.promiseRiskLevel === 'MEDIUM') {
      insights.push({
        code: 'PROMISE_FIDELITY_MEDIUM_RISK',
        severity: 'WARN',
        message: `${pct}% of promised delivery dates were honoured (${promiseRisk.promiseHonouredCount} of ${promiseRisk.promiseGivenCount} orders). Below target fidelity — consider adding buffer days to planned delivery schedules.`,
        evidenceKeys: ['promiseRisk.promiseHonouredBps'],
      });
    }
  }

  // --- Positive reinforcement ---
  if (insights.length === 0 && evaluation.status === 'HEALTHY') {
    insights.push({
      code: 'ALL_HEALTHY',
      severity: 'INFO',
      message: `No deterioration triggers detected. This supplier's fill rate, OTIF, and cancellation rate are all stable against the historical baseline. ${evaluation.recent.evaluatedOrders} evaluated orders in the recent window.`,
      evidenceKeys: ['status', 'triggers'],
    });
  }

  // Sort: CRITICAL first, then WARN, then INFO
  const order: Record<CoachingInsightSeverity, number> = { CRITICAL: 0, WARN: 1, INFO: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}
