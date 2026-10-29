# v7 classifier data: sources and provenance

## Labels
- Every lexicon item, old (v6) and new, gets a blind relabel from Claude Sonnet (effort low) against `ml-service/data/CATEGORY_RUBRIC.md`, using `classifier/claude_labels.py`.
- When the generator and Sonnet disagree, Claude Opus labels the item blind. The vote is generator + Sonnet + Opus with a strict majority, so an item is dropped when all three disagree or when the winning label is XX (not an expense).
- Phase 0 audit of the v6 lexicon:
  - Sonnet disagreed with 15.6% of the voted v6 labels.
  - In a 150-item sample, 51% of the disagreements were v6 errors, 24% were old-rubric Education|Investment labels (mapped to Need at training time), 21% were ambiguous, and 3% were Sonnet errors.
  - That puts clearly wrong v6 labels at about 8% of items.
  - Of the 1,417 disputes, Opus sided with Sonnet in 83%, with the v6 generator in 6%, and with neither in 10%.

## Seed merchant lists (`ml-service/data/v7_lexicon/*__90.json`)
- Sonnet agents were asked to transcribe these from authoritative lists. They mostly wrote names from model knowledge instead. Only one list was fetched: https://en.wikipedia.org/wiki/List_of_restaurant_chains_in_India
- Treat the seeds as model-recalled names, not transcribed registries.
- Templated padding was capped at 8 entries per first word.
- Seeds go through the same Sonnet/Opus relabel as every other item.

## Bank-statement narration formats
Used in `generate_llm_dataset.expand_merchant` / `person_transfers` and in `evaluation/gold_v7.csv`:
- HDFC UPI: `UPI-<NAME>-<vpa>-<IFSC>-<ref>-PAYMENT FROM PHONE`, seen in a public HDFC statement and described in https://aiaccountant.com/blog/smart-narration-parsing-indian-statements
- SBI: `TO TRANSFER-UPI/DR/<ref>/<NAME>/<bank>/<vpa>/<note>--`. The pattern comes from public SBI statements: https://sophiecress.com/blog/dr-debit-in-sbi-meaning
- ICICI legend (BIL, ONL, MMT/IMPS, VPS/IPS card purchases, NFS cash withdrawal): https://www.scribd.com/document/691972185/DetailedStatement
- UPI P2M/P2P, NEFT/IMPS/NACH layouts: https://www.terra-insight.com/insights/bank-statement-narration-patterns-india
- Axis `UPI/P2M/...`, Kotak `UPI/<NAME>/<ref>/<note>` and `PCD/...`, HDFC `NWD-`/`ATW-` ATM and `ACH D-` lines are from common retail statement layouts. No single public source documents them.

## Normalisation fixes found by this research (`classifier/normalize.py`, mirrored in `server/services/MerchantMemoryService.js`)
- A VPA local part with a digit (`swiggy8@ybl`) used to be dropped, so ICICI-style lines lost the merchant entirely. Now the digits are stripped instead.
- HDFC repeats the payee as both name and VPA, so repeated tokens are now dropped.
- Short brand tokens with digits (`1mg`, `box8`, `5paisa`) are now kept. Reference numbers, card masks and terminal IDs are still removed.
- New rail tokens: NWD, ATW, WDL, PCD, YESB, YBS, NETBANK, AUTOPAY.

## Gold evaluation set (`ml-service/evaluation/gold_v7.csv`)
- 926 rows written and labelled by Claude Opus to the rubric. Known merchants and invented local names are wrapped in the formats above.
- 397 rows are in the `unseen` slice: names or phrasing absent from every lexicon and seed list when the set was built.
- Rows matching the 140 human held-out rows or the challenge set after cleaning were removed. Training rows matching the gold set after cleaning are excluded by `generate_llm_dataset`.
- Caveat: Claude wrote both this set and the v7 labels, so scores here are likely optimistic compared with real statements (`evaluation/real_transactions.csv`).
- Baseline: live v6 scores 69.5% joint (±3.0%) on this set (rules 97.8% on their rows, model 60.4% on the rest). That compares with 93.6% on the 140 human rows.
