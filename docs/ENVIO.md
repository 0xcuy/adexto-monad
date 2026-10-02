# Indexing Monad with Envio

> [!NOTE]
> The long version of the README's Envio section, moved here on 2 October 2026. The comparison table is a dated
> record: re-run the method rather than quoting the numbers. The indexer covers the `0.11.0` factory and every
> curve it deploys; following the v1 factory as well is the next step.

Source: [`envio/`](https://github.com/0xcuy/adexto/tree/main/envio) in the parent repo. Indexes
`AdextoFactory` 0.11.0 and every curve it deploys — launches, swaps, buyback burns, fee claims,
ERC-8004 bindings.

## Why a separate indexer and not one more network on the subgraph

The Graph does not serve Monad. Checked against `graphprotocol/networks-registry`, `monad` is
listed **without** Subgraphs support — Firehose and Substreams only — so Studio will not accept
it however the manifest is written. The alternative was running our own Graph Node for Monad,
which means maintaining tens of GB of chain state.

## Why HyperSync and not RPC

Measured both ways in one sitting, same block range, same handlers:

| Source | Full history from the factory's deploy block |
| --- | --- |
| HyperSync | 1.93M blocks in **under 45 seconds**, 0 warnings, 0 errors |
| `rpc.monad.xyz` | ~83 blocks/sec → **about 6 hours** |

The six-hour figure is not a criticism of the RPC, it is the
[100-block cap](PARCEL.md#why-the-history-is-stored-rather-than-re-scanned) doing arithmetic: 1.93M
blocks divided by a 100-block `eth_getLogs` window is roughly 19,200 sequential calls. That is
the same constraint that limits a live scan to about eight minutes, seen from the other end.

RPC stays configured as a fallback. Worth being precise about what that covers: a HyperSync that
answers badly, **not** one that never authenticates. With no `ENVIO_API_TOKEN` the indexer stops
on the first fetch rather than quietly degrading.

## Query it yourself, no account and no key

```bash
curl -s -X POST https://adexto.xyz/api/indexer/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ Curve { id swapCount volumeNative totalProtocolFees } Swap_aggregate { aggregate { count } } }"}'
```

`GET` the same URL for the entity list and the live sync position. Introspection is on, so any
GraphQL client can explore the schema.

Read-only is enforced by the database role, not by the endpoint: unauthenticated requests map
to a role with `select` permissions only, so the public schema has no mutation root — a
`mutation` is answered with `no mutations exist`. Hasura's own admin surfaces, `/v1/metadata`
and `/v2/query`, are not reachable through it.

## Verified against contract storage, not against itself

An indexer that is internally consistent can still be uniformly wrong, so every figure was
compared with what the curve contract stores — including the live fee ledger
(`treasuryNative`, `creatorOwed`, `protocolOwed`) rather than only derived totals.

Read from the curves today. `$CURB` is frozen because it stopped being traded when it was
delisted; `$PARCEL` keeps moving, so **these are the values at the time of writing and not
constants** — the check that matters is the method, and re-running it should produce newer
numbers that still agree with each other.

| | $CURB | $PARCEL |
| --- | --- | --- |
| `swapCount` | 5 | 12 |
| `totalVolumeNative` | `104240006234326264` | `8832707966883005472` |
| `totalDepthFeesRetained` | `156360009351489` | `13249061950324507` |
| `treasuryNative` | `52120003117163` | `4416353983441502` |
| `creatorOwed` | `11000000000000` | `8739467960696060` |
| `protocolOwed` | `104240006234326` | `8832707966883004` |
| `totalTokensBurned` | `0` | `0` |
| ERC-8004 | agent `10251` | agent `10251` |

**Two of the twenty-two comparisons did not match on the first run, and that is the useful
part.** Sell volume was short by exactly `92,960,024,747,776` wei on $PARCEL and
`92,960,024,937,304` on $CURB — in both cases precisely the 40 bps of fees on the one sell leg.
The handler was reading the sell event's `amountOut`, the native the seller actually receives
after fees, while `buy()` counts `msg.value`, which is gross. The same trade size was
registering as two different volumes depending on direction.

The contract had this bug first and already fixed it; the comment on
`totalVolumeNative += leaving + depthFee` in `AdextoCurve.sol` says so. Checkable without
trusting any of this: the protocol leg is 10 bps of gross volume, so `totalVolumeNative / 1000`
on chain equals `totalProtocolFees`. It does, on both markets. After the fix all twenty-two
match.

`$CURB` is indexed even though it is [no longer listed](PARCEL.md#curb-and-why-the-count-is-2). It sits
at `projectAt(0)` permanently, so an indexer reporting one launch would be wrong about the chain
— and that is the first number anyone can check with a single `eth_call`. Delisting is a registry
decision; indexing is a question of what exists.

## What the schema is careful about

Each of these is a place where a plausible implementation reports a wrong number without raising
an error.

- **`openingPriceNative` is derived, never copied from `CurveInitialized.openingPrice`.** That
  parameter is the raw contract value, wei per 1e18-token. Copying it would put three fields
  whose names all end in `PriceNative` into two units that differ by 1e18.
- **`protocolFee` is not added to `totalDepthFees`.** The depth slice settles inside the curve
  and is what lifts the price floor; the protocol slice leaves it. Summing both reports a floor
  higher than the curve can pay.
- **`agentBound` is stored explicitly, not derived from `agentId != 0`.** Agent id 0 is a real
  agent owned by someone on all four mainnets.
- **`AgentBinding` is its own entity**, because the factory emits `AgentBound` *before*
  `TrinityProjectDeployed` — `Project` does not exist yet when the binding arrives.
- **A buyback increments `swapCount`**, matching the contract. Not following it would make the
  on-chain and indexed counters differ forever.
- **Zero is never accepted as a candle low.** A zero price only means the token reserve is
  empty; letting it through drops every candle to zero.
- **`ProtocolFeeClaim` records both `to` and `caller`.** `claimProtocolFees()` is
  permissionless, so storing both is the only way to show the destination cannot be hijacked by
  whoever triggers it.

No handler makes a contract call. Everything needed is already in the events, and an `eth_call`
would reintroduce the per-block RPC dependency this exists to escape.

---

[Back to the README](../README.md)
