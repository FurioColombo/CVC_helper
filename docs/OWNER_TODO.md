# Owner todo

This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.

Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).

<a id="b7-phone-choice"></a>

## Reach two courses on one account, see both, and keep one — B7

**State:** Ready for owner check · Required

**What to do:**

1. Open CVC Helper Test at https://furiocolombo.github.io/CVC_helper_test/ on the phone and on the PC. Impostazioni should show version 0.5.4; if it shows 0.5.3, close the app fully and open it again. B7-KEEP-RULE is already in place.
2. Use invented data only. These steps erase one test course for good. Start with the account holding no course: if it holds one, on the phone use Impostazioni, Elimina il corso e inizia un nuovo corso. Keep the app open on the phone and on the PC, both signed in to the same account and both on Crea il corso.
3. Put the phone in airplane mode. On the phone, create a course, Cabinato level 3, with one invented student.
4. On the PC, create a different course, Deriva level 2, with one invented student. Wait for Copia online aggiornata in Impostazioni.
5. Turn airplane mode off and keep the app open on the phone for up to two minutes. Both devices should reopen by themselves on Scegli il corso da tenere, with two cards showing code, counts, last change and the account's email. Neither should stop on an error. Say whether the sentence about typing that may be lost was clear.
6. On the phone, tap Salva file on either card: a file should start saving, and the page should name it and say it holds personal data.
7. Put the phone in airplane mode again: Tieni questo corso goes grey and the page says the choice needs a connection. Turn airplane mode off and wait for the buttons to return.
8. On the phone, tap Tieni questo corso on Cabinato 3. The page should ask to confirm, naming the course it will erase and what that course contains. Tick Ho capito and tap Elimina.
9. The phone should open Cabinato 3 with its student. On the PC, Deriva 2 should leave by itself and Cabinato 3 should open, with no second choice. Reload both after a minute: only that course, with its student.
10. Report B7-PHONE-CHOICE with what you saw at each step, and which you skipped.

Use the test address below and the linked device instructions.

**Expected:** An account holding two courses never locks a device: you see both, can save either to a file, keep one, and every device then opens on that one with nothing of it lost. Only your actual observations can pass this check.

**Build:** `cb51dbb1d859bc92afc9a7cd4ce37fe55f3c95cf`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of B7 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="b3-email-code"></a>

## Add the sign-in code to the backend email, with a custom email sender — UG4

**State:** Setup needed · Optional

**What to do:**

1. Not possible yet: Supabase lets you edit the email only after you set up your own email sender (Authentication &gt; Emails &gt; Set up SMTP). With its built-in sender the email carries just the link.
2. Nothing to do for the Android check: on Android the link opens in Chrome, which shares the installed app's storage.
3. Before production (UG4) a custom sender is needed anyway (the built-in one only delivers to your Supabase team and a few emails an hour); add &lt;p&gt;Codice: {{ .Token }}&lt;/p&gt; to the Magic link template then. Report B3-EMAIL-CODE with "code added" if you do it earlier.

**Expected:** Each sign-in email carries both the link and a numeric code, so Impostazioni can sign in where the link opens in another browser (an iPhone home-screen app). Deferred until a custom email sender exists.

**Build:** No test build is assigned yet.

**Work affected:** No required milestone completion is blocked.

<a id="wx1-phone-vento"></a>

## Read Vento on your Android phone, with and without signal — WX1

**State:** Setup needed · Required

**What to do:**

1. Not yet: it needs WX1's test build, which can replace CVC Helper Test 0.5.4 only after B7-PHONE-CHOICE. The address follows here when it is ready.
2. Use a course with invented data. On Home, before opening Vento, note what the Vento line says.
3. Open Vento with signal. It should show the next outing (morning 9-12:30 or afternoon 15-18) with the expected wind, gust and the likely range, sky and temperatures, and the hour row with the extra hours greyed. Say whether the numbers match what you expect for the day, and whether anything is hard to read in the sun.
4. Switch Numeri and Mappa: the map should show the area's coast and each point's wind at the hour picked. Then tap a half-day in the week: it should appear above, and one button should bring back the next outing.
5. Switch to the other area (Derive or Cabinati) and back.
6. Go back to Home: the Vento line should now quote the next outing. Put the phone in airplane mode, close the app fully and open it again: Home and Vento should still show the forecast with its age, without any error.
7. Open Impostazioni and read Previsioni del vento: say whether it is clear what Vento sends and to whom.
8. Report WX1-PHONE-VENTO with what you saw at each step, the phone and the browser, and which steps you skipped.

No phone-test build is ready. Wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Preparing setup does not mark that work verified.

**Expected:** Vento shows each area's next outing with expected wind, gust and range from a real download; without signal it keeps the last forecast with its age; Home quotes it without connecting. Only your actual observations can pass this check.

**Build:** No test build is assigned yet.

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of WX1 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="wx1-places"></a>

## Confirm the session hours and the forecast points — WX1

**State:** Ready for owner check · Required

**What to do:**

1. Derive: done on 2026-11-11 from your answer. Cala Fico is at 41.1859 N 9.4442 E, and the forecast points become Cala Fico 41.185 N 9.448 E, Isola del Porco 41.1757 N 9.4597 E and Punta Rossa 41.1712 N 9.4659 E, inside or at the edge of the areas you drew. Say so only if one is wrong.
2. Session hours: done. The CT guide you shared has boats out 09:00-12:30 and 15:00-18:00, and Vento's numbers are those hours. On 2026-11-12 you asked for an hour more on each side to read the trend, so the hour row and the map show 8 to 14 and 14 to 19, the extra hours greyed (decision 27). Say so if you meant the numbers to include them.
3. Cabinati points: Spargi 41.24 N 9.325 E, La Maddalena nord 41.265 N 9.41 E, Caprera est 41.215 N 9.5 E, Caprera sud 41.168 N 9.465 E, Liscia di Vacca 41.148 N 9.53 E, Cannigione 41.125 N 9.445 E. The new map view shows where they are. Tell me 'points right' or the corrections.
4. Optional: what the four colours of your drawing mean (course levels?), and where Cala Merda is when you remember.

**Expected:** The forecast is asked for where the boats actually sail, and each session is the part of the day you are on the water.

**Build:** No test build is assigned yet.

**Work affected:** Completion of WX1 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="wx1-terms"></a>

## Tell LaMMA about the use, and check Open-Meteo's terms — WX1

**State:** Ready for owner check · Required

**What to do:**

1. LaMMA's disclaimer asks that information on the use of its products be sent to it. Write to info@lamma.toscana.it: CVC Helper, a tool for the Caprera sailing centre's instructors, shows LaMMA's Bocche di Bonifacio wind and wave maps unaltered, with credit and a link. You may also ask whether they could offer a point series or allow a browser to read their data for Caprera.
2. Open-Meteo: done on 2026-11-11. You decided the centre's use is non-commercial under their free terms. Their data is licensed CC BY 4.0, so Vento and the Home line that quotes it both credit Open-Meteo; nothing more is needed from you.
3. Tell me when you have written to LaMMA and what they answer. I do not write to them on your behalf.

**Expected:** Both providers' terms are respected before Vento reaches anyone but you.

**Build:** No test build is assigned yet.

**Work affected:** Completion of WX1 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

## Passed

- <a id="b2-backend-setup"></a>Create the 0.5.0 development backend projects — B2, recorded 2026-10-25: report in `.evidence/B2/owner-setup.json`
- <a id="b3-phone-signin"></a>Sign in to the online backup on Android and use it offline — B3, recorded 2026-10-26: report in `.evidence/B3/physical-device-review.json`
- <a id="b4-phone-uploads"></a>Update to 0.5.3: the PC finishes its restore and follows the phone — B4, recorded 2026-11-09: report in `.evidence/B4/physical-device-review.json`
- <a id="b5-minimum-read"></a>Let the app read the server's minimum app version — B5, recorded 2026-11-04: report in `.evidence/B5/physical-device-review.json`
- <a id="b5-phone-restore"></a>Restore your course on an emptied phone, and see the question for another course — B5, recorded 2026-11-09: report in `.evidence/B5/physical-device-review.json`
- <a id="b6-erase-rules"></a>Let the server keep an erased course erased — B6, recorded 2026-11-04: report in `.evidence/B6/physical-device-review.json`
- <a id="b6-phone-erase"></a>Erase your course on the phone, once offline, and see it gone from the backup — B6, recorded 2026-11-11: report in `.evidence/B6/physical-device-review.json`
- <a id="b7-keep-rule"></a>Let the server keep the one course you choose — B7, recorded 2026-11-09: report in `.evidence/B7/physical-device-review.json`
- <a id="d3-phone-update"></a>Install CVC Helper Test and check Android updates — D3, recorded 2026-10-19: report in `.evidence/D3/physical-device-review.json`
- <a id="d4-phone-transfer"></a>Check course files, persistent storage and full reset on Android — D4, recorded 2026-10-20: report in `.evidence/D4/physical-device-review.json`
- <a id="ug3-final-build"></a>Confirm the final 0.4.0 build on your regular app — UG3, recorded 2026-10-24: report in `.evidence/UG3/physical-device-review.json`
- <a id="ug3-phone-release"></a>Check the 0.4.0 release build on Android — UG3, recorded 2026-10-22: report in `.evidence/UG3/physical-device-review.json`
- <a id="ug3-regular-update"></a>Update your regular CVC Helper from 0.3.0 to 0.4.0 — UG3, recorded 2026-10-22: report in `.evidence/UG3/physical-device-review.json`
- <a id="wx1-network"></a>Let Vento fetch forecasts before sign-in — WX1, recorded 2026-11-05: report in `.evidence/WX1/owner-setup.json`
