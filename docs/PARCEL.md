# $PARCEL, the first market on Monad

> [!NOTE]
> A dated record. This is the market's first session as written between 11 and 30 September 2026, moved out of the
> README on 2 October 2026 with its figures unchanged. The market has traded since: `swapCount()` read 18 on
> 2 October, and the last two of those were the deployer's own round trip testing the stake hub. Read the curve
> for today's numbers rather than quoting these.

## The live Monad market

**Open the terminal:
[`adexto.xyz/token/parcel?chain=143&tf=900`](https://adexto.xyz/token/parcel?chain=143&tf=900)**

This is the reference market for everything below. It was created through the production
studio at `adexto.xyz` — not a script and not a local build — so every screen a judge can
open is the same screen that produced it. One transaction created the token, its curve and
its full supply, with no liquidity deposit at any point.

| | |
| --- | --- |
| Token | [`0xC0B02176D37C1a64A6B493335115dB5D6D645E1F`](https://monadscan.com/address/0xC0B02176D37C1a64A6B493335115dB5D6D645E1F) |
| Curve | [`0x36F2E236Bd37830BbF52c1248DeE28770C8F4eCb`](https://monadscan.com/address/0x36F2E236Bd37830BbF52c1248DeE28770C8F4eCb) |
| Launch tx | [`0x876dbd3b…10ea4396`](https://monadscan.com/tx/0x876dbd3bb9013c87720ee570fc1b988234a3b8f9686a1555f0f4dd8a10ea4396) |
| Block · time | `103878638` · 2026-09-11 10:59:53 UTC |
| Launch cost | `3,229,629` gas — **0.329422158 MON** at 102 gwei, gas only |
| Supply | `1,000,000,000` PARCEL, 100% in the curve |
| Opening reserve | `virtualNative` 174,888.464882 MON, virtual — never deposited |
| Fee legs | depth 15 · creator 10 · buyback 5 bps, plus 10 bps protocol charged on top |
| Agent | ERC-8004 `agentId` 10251, bound at creation, `agentBound` true |

**Timeframes at the link.** `tf=3600` opens hourly candles, which is the widest view this
market can currently fill. `tf=1` is where a market this young actually reads: five fills
produce 116 one-second bars against 4 at one minute, because the sub-minute bucket is the
only one that gives each fill its own candle.

### The five trades, on chain

All five are real swaps against the curve, executed through the terminal and the `/swap` page
in one recorded session. `buy · buy · sell · buy · buy`, which is a shape a market makes
rather than a demo script that only ever buys.

| # | Side | Block | Amount | Transaction |
| --- | --- | --- | --- | --- |
| 1 | BUY | `103878737` | 0.035 MON → 199.3270 PARCEL | [`0xaa6a4df7…3ec23363`](https://monadscan.com/tx/0xaa6a4df7776aa4e705a8a5ff3aa83b2e85b71a008dad23b5ff8cc6983ec23363) |
| 2 | BUY | `103878794` | 0.035 MON → 199.3269 PARCEL | [`0xa1ceaf56…ef37b424`](https://monadscan.com/tx/0xa1ceaf56b63c57d910f92f2cdb7b008551debac5b5e98bbed6c679a9ef37b424) |
| 3 | SELL | `103878829` | 132.8846 PARCEL → 0.023147 MON | [`0x11608ef6…71b70abe`](https://monadscan.com/tx/0x11608ef6fbcc487614a89e108c436ef9449681bd36822f8f2ea1268371b70abe) |
| 4 | BUY | `103878904` | 0.035 MON → 199.3269 PARCEL | [`0x2c58de3c…809ea66d`](https://monadscan.com/tx/0x2c58de3c3f8fc32e2b4533a2ff8df8cd0f9e953cc428e30c93fa4133809ea66d) |
| 5 | BUY | `103878924` | 0.06125 MON → 348.8219 PARCEL | [`0x81c1de1a…1e155502`](https://monadscan.com/tx/0x81c1de1af5271719ca4882b7865f370ee0e2f7e1000e4dea87adc06d1e155502) |

The sell is the row that matters. It went through `approve` then `sell` against the curve,
which is the exit path a bonding curve is usually accused of not having — there is no
graduation to an external pool here, so the curve has to be the venue in both directions or
the market is a trap.

Curve state immediately after that session, read back from the contract:

```
swapCount           5
treasuryNative      0.000094745003093472 MON   accrued to the buyback vault
creatorOwed         0.00009625 MON             accrued from swap flow
```

**Read again today it says `swapCount 12`, and the extra fills are the point rather than a
correction.** Two of them are the [cross-chain x402 buys](X402.md#the-cross-chain-buys-that-actually-happened)
and the rest are ordinary trading since. An x402 delivery is an ordinary `buy` against this
curve, so it pays the same fee legs as anything else and the counter moves. Nothing separate
had to be wired for that.

```
swapCount           12
treasuryNative      0.004416353983441502 MON   grew 46x on the fills since
creatorOwed         0.008739467960696060 MON
protocolOwed        0.008832707966883004 MON
totalVolumeNative   8.832707966883005472 MON
```

The buyback vault filling up on its own is worth noticing: `treasuryNative` is fillable only
by the curve's own buyback fee leg, and the x402 fills paid it without anything routing
revenue anywhere. `totalTokensBurned` is still `0` because the burn fires on a gas threshold,
which is the gate working rather than a gap — and it is worth saying plainly that the
threshold has never been crossed on this market, so the burn is proven on 0G and not here.

Checkable without trusting any of the above: the protocol leg is 10 bps of gross volume, so
`totalVolumeNative / 1000` should equal `protocolOwed` while nothing has been claimed.
`8832707966883005472 / 1000` is `8832707966883005`, against `8832707966883004` stored — one wei
of integer truncation, which is the arithmetic agreeing rather than a discrepancy.

### Measured settlement cost, not estimated

Track 01 is judged on economics, so these are receipts rather than estimates. Every one is
`status=1`.

| Action | Gas | Cost at 102 gwei |
| --- | --- | --- |
| Launch — token + curve + supply, one tx | `3,229,629` | 0.329422158 MON |
| First buy on a cold curve | `324,307` | 0.033079314 MON |
| Steady-state buy | `119,851` | 0.012224802 MON |
| Sell, including the `approve` leg | `145,288` | 0.014819376 MON |
| **Five swaps, total** | — | **0.08667858 MON** |

The first buy costs 2.7× a later one because it writes storage slots that do not exist yet on
a curve nobody has touched. Quoting the cold number as typical would overstate the cost of
trading here by almost three times, which is why both are listed separately rather than
averaged into one figure.

Whole session, launch plus five trades: **0.416 MON**, gas only, no deposit at any point.

Creator revenue accrued from those swaps and was **claimed to zero** during the same session.
That is the whole creator model: paid out of flow, never holding an allocation, so there is no
supply overhang to disclose.

### Why the history is stored rather than re-scanned

The trade feed reads a stored copy of these five swaps, and the label says `on-chain` because
each record carries its own `txHash`, `blockNumber` and block timestamp — verifiable one row
at a time in the table above.

That indirection is a Monad-specific constraint, not a shortcut. Monad's RPC caps
`eth_getLogs` at **100 blocks per call**. With a 16-call budget per page load, the reachable
window is 1,600 blocks — roughly eight minutes — so a live scan cannot see this market's own
launch, and raising the budget would mean hundreds of sequential RPC calls for one page view.
The swaps are therefore read once from chain and persisted. **The indexer that removes the
reason for that store now exists** — see [Indexing Monad with Envio](ENVIO.md).

### $CURB, and why the count is 2

`totalProjectsCount` on the Monad factory reads `2`. The other launch is `$CURB`
([`0x8AB19c43…`](https://monadscan.com/address/0x8AB19c43Dc0b66240BF1404A6e78135C14836eE0)),
the first market opened here. It was replaced by `$PARCEL` and its registry row was pulled, so
it is no longer listed on the site.

Nothing was taken from it, and that distinction is worth stating rather than glossing: the
curve still holds its reserves — nothing can be withdrawn from a curve — it is still tradable
directly against the contract, and the ticker stays claimed on this factory permanently
because `symbolRegistry` has no release function. `totalProjectsCount` cannot fall either.
Every launch that exists on chain is accounted for once in
[`src/config/onchain-launches.json`](https://github.com/0xcuy/adexto/blob/main/src/config/onchain-launches.json)
in the parent repo, and its consistency audit fails the build if an on-chain launch appears
that the file does not explain.

---

## The probe's readout, 30 September 2026

```
AdextoFactory        0x5800e9715a47a598fce9bc3B65a95FD6BeBf76A3
  VERSION            0.11.0
  bytecode           21,281 bytes
  PROTOCOL_FEE_BPS   10
  MAX_SUPPLY         1_000_000_000_000   (whole tokens, not wei)
  ANTI_SNIPER_BPS    100
  AGENT_REGISTRY     0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
  protocolTreasury   0x24268Fffc119ec5550F68e80D94476fD64daE967
  totalProjectsCount 2

deployTrinity        EXECUTED, 3,229,629 gas, 0.329422158 MON at 102 gwei
                     0x876dbd3bb9013c87720ee570fc1b988234a3b8f9686a1555f0f4dd8a10ea4396

allProjects(0)       0x8AB19c43Dc0b66240BF1404A6e78135C14836eE0   $CURB    delisted
allProjects(1)       0xC0B02176D37C1a64A6B493335115dB5D6D645E1F   $PARCEL  live
```

`allProjects(i)` returns the **token**, not the curve. Reading it the other way round puts
the two addresses in the wrong fields, and both respond to enough calls that the mistake does
not announce itself.

The simulation that preceded this predicted 3,159,443 gas against 3,229,629 actually used —
2.2% under. Recorded because the estimate is quoted elsewhere in this file's history, and a
prediction is worth less once the real number exists.

**Every new launch on Monad goes to ADEXTO v1.** `$PARCEL` stays on the `0.11.0` factory above
and keeps its terms, because every fee leg is `immutable`. The probe checks both:

```
AdextoFactory        0x3dFcBEd7dd889F465cC9f75c430B43Ef873b6056   ADEXTO v1
  VERSION            1.0.0
  bytecode           21,806 bytes, keccak 0x1ca02ca53a3b2a2082f9e5dab6924e1339110e3037608f750981699678881fd4
                     byte-identical on 0G, Base, Arbitrum One and Robinhood Chain
  PROTOCOL_FEE_BPS   10, carved out of the configured total
  AGENT_REGISTRY     0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
  protocolTreasury   0x24268Fffc119ec5550F68e80D94476fD64daE967
  totalProjectsCount 0
  deployed           block 109,440,540, tx 0x3c7f6259a4b47ffe03489e4fcf976e38e4930907758f2bc8fca649941462cc67

deployTrinity        simulated clean, 3,278,039 gas, ~0.334 MON at 102 gwei, split 100/70/10 bps
```

v1 differs from `0.11.0` where a trader or an agent would notice: the 0.10% protocol leg is
inside the configured total rather than added on top, the buyback can run at most once an hour,
and for the first 180 seconds no wallet may hold more than 1% of supply. That window is measured
in seconds, where `0.11.0` counted five blocks, which on Monad lasted about two seconds. The
source is commit [`71b5adf`](https://github.com/0xcuy/adexto/commit/71b5adfe774ed7a93f9fe589b4430c8122febb1f),
compiled with solc 0.8.37, and both Sourcify and Monadscan report it verified.

```
$PARCEL curve       0x36F2E236Bd37830BbF52c1248DeE28770C8F4eCb
  virtualNative      174888.464882 MON     virtual, never deposited
  swapCount          12                    5 by hand, 2 paid over x402, 5 since
  depthFeeBps        15
  creatorFeeBps      10
  treasuryBuybackBps 5
  treasuryNative     0.004416353983441502 MON
  creatorOwed        0.008739467960696060 MON
  protocolOwed       0.008832707966883004 MON
  totalVolumeNative  8.832707966883005472 MON
  totalTokensBurned  0                     vault below the gas threshold

$PARCEL token       0xC0B02176D37C1a64A6B493335115dB5D6D645E1F
  symbol             PARCEL
  name               Parcel Market
  totalSupply        1000000000.0
  agentBound         true
  agentId            10251
```

---

[Back to the README](../README.md)
