# Monad Metropolis submission

> [!NOTE]
> Moved out of the README on 2 October 2026. The in-window table stops at 14 September, when it was written; the
> work since (ADEXTO v1 on Monad, SAi Monad, per-market staking, the stake hub) is in the README and in the
> parent repository's history.

Built for [Monad Metropolis](https://monad.xyz/developers/hackathons/metropolis), build
window 1 September to 13 October 2026.

**Track 01 — Onchain Finance & Trading.** The track asks for new asset primitives, market
structures and trading experiences enabled by fast, cheap settlement. All three are the
subject here: a curve that opens without a deposit and cannot be withdrawn from, a terminal
built for markets minutes old, and settlement economics measured rather than asserted. Framing
it as infrastructure for agents does not move it out of this track: what an agent opens, is paid
by and is bought through is a market structure.

Track 04 was rejected deliberately. Its core is trust, provenance and user-owned data, and
this project does not do provenance — the 0G router's Intel TDX attestation is read as a
declaration and never verified here, which is why the parent repo's claim guard already bans
the phrase `Hardware Attested`. Entering that track would invite claims its own tooling
forbids.

Built inside the window, with dated commits in the parent repository:

| Work | Commit | Date |
| --- | --- | --- |
| Curve and factory 0.11.0, additive protocol fee leg | `cebed46` | 2026-09-07 |
| 0.11.0 broadcast to all four mainnets, Monad included | `e5fa698` | 2026-09-07 |
| Cross-chain buy on-ramp | `e095163` | 2026-09-10 |
| Integration reference page | `7f1ac4a` | 2026-09-10 |
| ERC-8004 agent registered on Monad, `agentId` 10251 | `0x09f1f8bf…` on chain | 2026-09-11 |
| **First market opened on Monad** and traded | `0x876dbd3b…` on chain | 2026-09-11 |
| **$PARCEL launched through the live site** and traded five times | [see above](PARCEL.md#the-live-monad-market) | 2026-09-11 |
| Candle width made independent of bar count across every market | `dfad26a` | 2026-09-11 |
| Monad read path cached and parallelised — 4.5s to 1.96s cold, 0.003s warm | `d47e246` | 2026-09-11 |
| Two paid cross-chain fills delivered on Monad, proven with real funds | `ad0f432` | 2026-09-13 |
| **Monad indexed with Envio HyperIndex**, full history from the deploy block | `acc8601` | 2026-09-13 |
| Terminal serves Monad history from the indexer, indexer runs as a service | `2ce989d` | 2026-09-14 |
| **Indexer public, anonymous and read-only** at `/api/indexer/graphql` | `e790bcc` | 2026-09-14 |
| **Monad reads moved to Alchemy** — `eth_getLogs` span 100 → 500,000 | `de4de50` | 2026-09-14 |
| Keyed Alchemy endpoint removed after measuring it worse than the shared one | `b23782f` | 2026-09-14 |

The last two are listed because they are Monad-specific engineering rather than cosmetics.
Monad's 100-block `eth_getLogs` cap meant the terminal re-ran sixteen sequential calls on
every request and cached none of them, since the zero-result path returned before the cache
was written — measured at five 4-second reads per thirty idle seconds against 38 ms for the
same page on 0G. The chain with the narrowest log window was the only one whose reads were
never remembered.

Predating the window, and therefore **not** claimed as new: the bonding-curve concept with
its earlier factory generations `0.9.0` and `0.10.0`, and the application shell — studio,
explorer, swap, terminal and wallet layer. Those are existing infrastructure this work
builds on.

## Outside recognition, and why it is listed separately

Selection into a programme is **not** engineering, so it is deliberately kept out of the table
above rather than padding it. It is recorded here because one part of it concerns this chain.

ADEXTO was presented at the **0G Atlas Founder House Demo Day on 18 September 2026**, one of
eight projects named in the announcement, and what was presented is the venue as it actually
runs — four mainnets, Monad among them. 0G also published a landscape of that ecosystem and
placed the project in its markets and coordination layer, **tagged for Base, Arbitrum and
Monad**. That tag is the part worth pointing at: it is the first time the multi-chain
deployment has been stated by someone other than this project.

The link between a demo given elsewhere and the market on this chain is checkable rather than
rhetorical. `AdextoFactory` `0.11.0` runtime bytecode is **byte-identical on all four
mainnets** — 21,281 bytes, keccak
`0xcbb89e32ae973400723287f16f32e87f039efcef1c1f814c5805bd1a6fe3add8`, read back with
`eth_getCode` from each chain rather than compared against a local build. So the launch and
trade path shown there is the same bytecode that serves
[`$PARCEL`](PARCEL.md#the-live-monad-market), not a port of it. Hash
[the Monad factory](https://monadscan.com/address/0x5800e9715a47a598fce9bc3B65a95FD6BeBf76A3)
and check.

All three artefacts, each with its source and with the places where the publishers' wording
differs from ours, are collected at
[**adexto.xyz/recognition**](https://adexto.xyz/recognition). Two of them — the Demo Day
announcement and the landscape map — are from the Bali house; the third is a 0G developer
showcase from Zero Gravity Taipei, a **different event**, and it is presented as such rather
than folded in to make one appearance look like two.

Two things stated plainly because they cut the other way. The publishers describe this as a
launchpad; we do not, because a launchpad hands over a token and a page while one transaction
here opens a market that trades from its first block. And the showcase slide carries a footnote
that on-chain volume is still very low and that this project states it cannot independently
verify raw TDX quotes — both true, both already in this repository's own documentation, and
quoted on that page rather than cropped out.

Recorded in the Metropolis Progress Updates tab as update #8, posted 21 September 2026, whose
opening item is the Alchemy work above rather than the event.

---

[Back to the README](../README.md)
