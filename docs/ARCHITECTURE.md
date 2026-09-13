# Architecture

Deeper detail than the README. This document explains **why** each boundary sits where it
does, because most of these choices were made by discovering the failure first.

- [Trust boundaries](#trust-boundaries)
- [State machine of a request](#state-machine-of-a-request)
- [Where a caller could attack, and what stops them](#where-a-caller-could-attack-and-what-stops-them)
- [Failure modes and who absorbs them](#failure-modes-and-who-absorbs-them)
- [Pricing and why the first price was wrong](#pricing-and-why-the-first-price-was-wrong)
- [Making delivery multi-chain](#making-delivery-multi-chain)
- [Key custody](#key-custody)

---

## Trust boundaries

```mermaid
flowchart TB
    subgraph untrusted["Untrusted input"]
        direction LR
        H["Request headers"]
        QP["Query parameters"]
        SIG["Submitted signature"]
    end

    subgraph worker["Edge worker · trusted logic, no secrets in the request path"]
        direction LR
        RES["Ticker resolution"]
        VER["Signature verification"]
        CFG["Payee from environment"]
    end

    subgraph authority["Sources of truth"]
        direction LR
        REG["Market registry"]
        TOK["USDC contract"]
        CUR["Curve contract"]
    end

    H --> VER
    QP --> RES
    SIG --> VER

    RES -->|"ticker, never an address"| REG
    VER -->|"EIP-712 domain read here"| TOK
    CFG -.->|"never from a header"| VER
    VER --> CUR

    style untrusted fill:#fff5f5,stroke:#e53e3e
    style authority fill:#f0fff4,stroke:#38a169
```

The rule the diagram encodes: **nothing that decides where money goes may originate in the
request.** The payee comes from worker configuration. The curve comes from the registry.
The signing domain comes from the token contract. A caller controls only what they are
paying for and, optionally, which address receives the tokens.

That last exception is deliberate and bounded. If `?to=` is absent the recipient defaults
to the address that **signed** the payment, which is the only party provably in control of
the funds.

---

## State machine of a request

```mermaid
stateDiagram-v2
    [*] --> Resolving

    Resolving --> Unknown: ticker not in registry
    Resolving --> NotTradable: market exists, not tradable
    Resolving --> Quoting

    Quoting --> NoQuote: price feed unavailable
    Quoting --> Challenge: no X-PAYMENT header
    Quoting --> CheckStock

    CheckStock --> OutOfStock: native inventory too low
    CheckStock --> Verifying

    Verifying --> Rejected: signature or terms invalid
    Verifying --> Delivering

    Delivering --> DeliveryFailed: buy reverted
    Delivering --> Unconfirmed: receipt unreadable
    Delivering --> Settling

    Settling --> Settled
    Settling --> Unpaid: settlement failed

    Unknown --> [*]: 404
    NotTradable --> [*]: 409
    NoQuote --> [*]: 503
    Challenge --> [*]: 402
    OutOfStock --> [*]: 503
    Rejected --> [*]: 402
    DeliveryFailed --> [*]: 502
    Unconfirmed --> [*]: 202
    Settled --> [*]: 200
    Unpaid --> [*]: 200, nothing owed
```

Two transitions carry most of the design weight.

**`CheckStock` runs before `Verifying`.** Filling an order means spending native balance
the protocol holds, so capacity is finite. Checking it before touching anyone's money
means a caller who cannot be served gets `503` with their authorization still unspent,
rather than paying for something undeliverable.

**`Unpaid` still returns `200`.** If delivery succeeded but settlement failed, the tokens
are already in the buyer's wallet. The response says so and states that nothing is owed.
Reporting an error there would be false — the buyer got what they asked for — and
retrying would deliver twice.

---

## Where a caller could attack, and what stops them

| Attack | What it would achieve | What stops it |
| --- | --- | --- |
| Supply a curve address directly | Spend protocol funds on a contract of the attacker's choosing | Requests name a ticker; the address is resolved through the registry |
| Supply the payee in a header | Redirect the USDC | Payee is read from worker environment. The header that once did this was removed |
| Forge a transfer authorization | Receive tokens without paying | Signature is recovered and matched to `from`; USDC re-checks it during settlement |
| Replay a spent authorization | Pay once, buy repeatedly | EIP-3009 records the nonce on-chain; `authorizationState` is checked before both verify and settle |
| Sign a smaller amount than quoted | Underpay | Signed `value` is compared against `maxAmountRequired` |
| Sign for a different recipient | Divert payment | Signed `to` is compared against the configured payee |
| Craft a favourable EIP-712 domain | Make an invalid signature verify | Domain is read from the token contract, not from `extra` |
| Race the quote | Get a better fill than quoted | `minTokensOut` is derived from the quote and enforced on-chain by the curve |
| Drain inventory cheaply | Exhaust native balance below cost | Spread and slippage in bps, plus a capacity check with gas headroom reserved |

The one thing deliberately **not** defended against is a leaked relayer key.
`transferWithAuthorization` is permissionless and its entire content is signed by the
payer, including `to` and `value`, so the relayer key carries no authority to move anyone's
funds or change a destination. The worst outcome of a leak is drained gas.

---

## Failure modes and who absorbs them

```mermaid
flowchart LR
    A["Delivery attempted"] --> B{"Receipt readable?"}
    B -->|"yes, status 1"| C["Charge the authorization"]
    B -->|"yes, reverted"| D["502 · protocol pays gas"]
    B -->|"no, timeout"| E["202 · no charge, hash returned"]

    C --> F{"Settlement succeeded?"}
    F -->|"yes"| G["200 · both hashes"]
    F -->|"no"| H["200 · buyer keeps tokens, nothing owed"]

    style D fill:#fff5f5
    style E fill:#fffaf0
    style H fill:#fffaf0
    style G fill:#f0fff4
```

Every non-green outcome above is absorbed by the protocol, not the buyer. That is the
direct consequence of ordering delivery before the charge, and it is the reason the
ordering is not treated as an implementation detail.

The `202` branch exists because of a real incident rather than caution. A 0G RPC node
answered `-32000 no matching receipts found` for a transaction that had already been
mined; `tx.wait()` reported that as a coalescing error; the worker concluded the delivery
had failed and charged nothing. The buyer received tokens for free and the inventory was
gone. Receipts are now polled with retries, and an unreadable receipt is reported as
unconfirmed with its hash — never as a failure, and never as grounds to charge.

---

## Pricing and why the first price was wrong

The first live price was `0.02 USDC` per fill. Measured against the actual transactions:

| Component | Value |
| --- | --- |
| Revenue at 0.02 USDC, 3% spread | ~$0.0006 |
| Base settlement gas | $0.00128 |
| Delivery gas on the target chain | $0.00008 |
| **Net margin on the first real fill** | **−$0.00075** |

Break-even sat near `$0.05`, so the price moved to `0.10 USDC`, where a 3% spread yields
roughly `+$0.0016` per fill. This is recorded because the mistake is instructive: the
spread was sized against the trade value while the dominant cost was **settlement gas on
the payment chain**, which is independent of trade size.

It also set an expectation for Monad, and that expectation has now been **measured** rather
than carried forward. A launch on Monad cost `0.329422158 MON` at 102 gwei against `~0.0127 0G`
at 4 gwei for identical factory bytecode. The number that matters for delivery is the fill,
not the launch, and on `$PARCEL` a steady-state buy cost `119,851` gas — `0.012224802 MON` —
while the very first buy against an untouched curve cost `324,307` gas because it writes
storage slots that do not exist yet.

That 2.7× gap is the part worth carrying into the delivery design: a cross-chain fill that
happens to be the first trade on a market pays nearly three times the steady-state cost, so a
spread sized on the steady-state number would be underwater on exactly the fill most likely to
be someone's first contact with the venue. Cold-start cost belongs in the quote, not in the
average.

---

## Making delivery multi-chain

**Done, and paid for twice.** The worker used to carry exactly one delivery endpoint, `OG_RPC`,
which made 0G not a choice but the only destination it could express. Worse, the failure was
mute: the provider was built as `JsonRpcProvider(env.OG_RPC, market.chainId)`, so it passed the
market's chain id correctly against an endpoint that answered a different one and threw
`network changed: 143 => 16661`. Read as a broken RPC, it actually meant the destination had
never been configured.

The delivery RPC is now resolved from the market's chain id, and a chain with no endpoint is
refused by naming the variable that would serve it instead of failing inside ethers. Two paid
fills have since settled on Base and delivered on Monad; the transactions are in the
[README](../README.md#the-cross-chain-buys-that-actually-happened).

```mermaid
flowchart LR
    subgraph before["Before · single target"]
        W1["Worker"] --> O1["OG_RPC"]
    end

    subgraph after["After · target as data"]
        W2["Worker"] --> T{"resolve target<br/>by chainId"}
        T --> M2["Monad · 143"]
        T --> O2["0G · 16661"]
        T --> N2["next chain"]
    end

    style N2 stroke-dasharray: 5 5
```

Copying `OG_RPC` into `MONAD_RPC` would work for two chains and break on the third. What
rots in that approach is not the code but the assumption that the number of destinations is
known when the config file is written. `src/chains.ts` makes destinations data, so adding a
chain is one entry.

Each target must carry its own RPC, native symbol, factory address with a verified
`VERSION`, agent registry, treasury, and a working explorer. The probe drift-checks the
last three against the chain on every run, so a stale entry is caught before it reaches a
payment path.

### The constraint this does not remove

Delivery spends the destination chain's native asset while the payment arrives as USDC on Base.
Revenue and inventory therefore accumulate on different chains, so the MON that funds Monad
fills has to be topped up by hand however well the margin performs. A paid request with an empty
inventory is refused with `out_of_inventory` **before** the payment is taken, so nothing is at
risk — but the refusal is a stock-out, not a bug, and it will keep happening until the loop
closes.

Monad publishes its own x402 facilitator, and it is the shape that would close it. Read from
`GET https://x402-facilitator.molandak.org/supported`: it advertises `eip155:143` with the
`exact` and `upto` schemes, signs from `0x7f6a2850669202519f0FE8aa912451238820Db86`, and settles
USDC at `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` — a real contract on Monad, `symbol` USDC,
six decimals. It covers settlement gas itself.

Settling a purchase in USDC **on Monad** would land the revenue on the same chain the inventory
drains from, which turns manual rebalancing into a swap that can be automated. That is not built
here, and it is listed as the reason to build it rather than as something that works. The
Base-settled leg stays regardless: paying from the chain where a buyer already holds funds is
the point of it, and a Monad-native leg answers a different question.

---

## Key custody

| Key | Holds | Blast radius if leaked |
| --- | --- | --- |
| Relayer / operator | Base gas, plus native inventory on delivery chains | Gas and inventory only. Cannot move a payer's funds or redirect a payment |
| Deployer | Factory deployments | Never placed in the edge environment |

The operator is a dedicated address, not the deployer. That separation is the reason a
compromise of the edge cannot reach contract deployment authority, and it is why the
relayer key can sit in a worker environment at all.

---

## Related

- [`README.md`](../README.md) — overview, status matrix, verified chain reads
- [`0xcuy/adexto`](https://github.com/0xcuy/adexto) — curve, factory, registry, web app
- [`adexto.xyz/x402`](https://adexto.xyz/x402) — the integration reference for the live endpoint
