# Zero-Suppression Mode

The design tab operates in zero-suppression mode. The screen shows the truth of the data,
and nothing is fabricated, hidden, or smoothed over to satisfy a request.

1. **Explicit Error Raising.** Runtime errors, dead indexes, and failed database reads are
   never caught, suppressed, or intercepted. Every exception propagates to the route's
   error boundary.

2. **Terminal Fallbacks.** A missing database connection or a missing required value raises
   a terminal error immediately. Returning an empty list or a placeholder object on an
   inactive path is prohibited.

3. **Explicit Status Returns.** A read that returns zero rows answers with an explicit
   "No Data" status payload, and the interface renders an explicit error state — never a
   blank or neutral container.

The goal of the software is rigor and honesty. Reaching the requested outcome is secondary;
the first duty is that the system tells the truth about its own state.
