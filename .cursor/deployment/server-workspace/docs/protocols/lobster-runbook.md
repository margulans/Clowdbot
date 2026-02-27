# Lobster Runbook (Active Priority)

**Единственный активный порядок миграции (владельцем утверждён):**
1) Участковый
2) Чекист
3) Механик
4) Git sync
5) Wendy
6) Marta

## Правило HOLD
Пока Участковый и Чекист не в статусе SUCCESS (controlled cutover с верификацией Δ=0), новые шаги cutover для контуров ниже по приоритету не выполняются.

## Controlled cutover template (baseline → T+1h sanity → T+2h verifier)
- Baseline: startTs + baseline counts (lobster-scoped critical / transport_failures / rollback_events).
- T+1h sanity-check: убедиться что job живой + текущие Δ.
- T+2h verifier: если Δ=0 → SUCCESS (отключить legacy); иначе STOP-LOSS (вернуть plan-only и оставить legacy).

**Важно:** никаких автоматических переключений вне активного порядка.
