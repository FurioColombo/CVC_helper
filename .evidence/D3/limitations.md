# D3 remaining acceptance and limits

Physical Android installation and the 0.4.0 → 0.4.1 installed-app update remain
the owner's required D3-PHONE-UPDATE check. No simulated result is a PASS.
The second deployment waits for an explicit first-install report; both patches
use the pinned verified source and stable test URL.

Non-blocking review findings are filed in docs/working/BACKLOG.md: DI-R2-Q4,
FU-Q7, FU-Q11, RH2-Q4 and RH4-Q1. Older versions predating the write guard
and local-only schema transitions have the documented limits in 03 §3.1.

The same-origin offline isolation check makes its owned origin transport
unreachable. It proves regular service-worker availability before/after test
erasure, with uncached fetch and fresh no-worker navigation negative controls.
It does not validate browser offline indicators or physical phones.
