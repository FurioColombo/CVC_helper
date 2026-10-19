# D3 remaining acceptance and limits

The owner accepted D3-PHONE-UPDATE on 2026-10-19 on a Motorola Edge 60
(browser and Android version not stated): 0.4.0 installed, the 0.4.1 offer
within seconds of returning without a reinstall, the updated version and kept
students, and Cerca aggiornamenti offline and online. Two steps were not
observed on the phone: typing a note and tapping Aggiorna at once, and the
Allievi and Equipaggi controls with enlarged text while the offer shows. Both
rest on the browser suite only and are scheduled in UG3's owner check. See physical-device-review.json.

Non-blocking review findings are filed in docs/working/BACKLOG.md: DI-R2-Q4,
FU-Q7, FU-Q11, RH2-Q4 and RH4-Q1. Older versions predating the write guard
and local-only schema transitions have the documented limits in 03 §3.1.

The same-origin offline isolation check makes its owned origin transport
unreachable. It proves regular service-worker availability before/after test
erasure, with uncached fetch and fresh no-worker navigation negative controls.
It does not validate browser offline indicators or physical phones.
