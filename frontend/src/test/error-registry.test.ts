/**
 * The provider-outage entry in the failure ledger.
 *
 * When DeepSeek is saturated it answers "Service is too busy" (a 503 that our own
 * backend then re-wraps as an A2UI FAILURE). Before PROVIDER-OVERLOADED, that raw
 * payload was shown to a person as if it were a fault in the app. The two cases here
 * pin the split: the provider's own "too busy" is a "try again later", while any
 * other 503 stays the generic ASSEMBLY-503 shape.
 */
import { describe, it, expect } from 'vitest';
import { classifyFailure } from '@/shared/error-registry';

const TOO_BUSY =
  "A2UI Assembly Failed: A2UI FAILURE: Error: DeepSeek API request failed: "
  + "Error code: 503 - {'error': {'message': 'Service is too busy. We advise users "
  + "to temporarily switch to alternative LLM API service providers.', "
  + "'type': 'service_unavailable_error', 'param': None, 'code': 'service_unavailable_error'}}";

describe('classifyFailure — provider outage', () => {
  it('reads "service is too busy" as a provider overload, not a backend fault', () => {
    const report = classifyFailure(new Error(TOO_BUSY), {
      intent: 'render-composer',
      httpStatus: 503,
    });

    expect(report.code).toBe('PROVIDER-OVERLOADED');
    expect(report.retryable).toBe(true);
    // The person sees "capacity", never the raw service_unavailable_error payload as the headline.
    expect(report.headline.toLowerCase()).toContain('capacity');
  });

  it('reads "service_unavailable_error" without the full sentence the same way', () => {
    const report = classifyFailure(
      new Error("A2UI FAILURE: Error: DeepSeek API request failed: Error code: 503 - "
        + "{'error': {'type': 'service_unavailable_error', 'message': 'Service is too busy'}}"),
      { intent: 'render-console', httpStatus: 503 },
    );

    expect(report.code).toBe('PROVIDER-OVERLOADED');
  });

  it('keeps every other 503 in the generic ASSEMBLY-503 shape', () => {
    const report = classifyFailure(
      new Error('A2UI Assembly Failed: A2UI FAILURE: some unrelated refusal'),
      { intent: 'render-composer', httpStatus: 503 },
    );

    expect(report.code).toBe('ASSEMBLY-503');
  });
});
