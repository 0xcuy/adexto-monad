/**
 * Probe tujuan pengiriman. HANYA membaca dan mensimulasi.
 *
 * KENAPA BERKAS INI YANG PERTAMA DITULIS DI REPO INI
 *
 * Seluruh rencana kaki pengiriman Monad berdiri di atas satu asumsi yang belum pernah
 * diuji: bahwa `deployTrinity` di Monad benar-benar bisa melahirkan pasar. Factory-nya
 * memang ada di sana, tetapi `totalProjectsCount` bernilai nol — jadi jalur itu belum
 * pernah dijalankan seorang pun, di chain mana pun yang bukan 0G.
 *
 * Asumsi seperti itu lebih murah dijawab sekarang daripada awal Oktober.
 *
 * KENAPA TIDAK ADA TRANSAKSI YANG DIKIRIM
 *
 * `staticCall` menjalankan fungsinya di node lalu membuang hasilnya, dan `estimateGas`
 * menuntut simulasi yang sama berhasil. Keduanya melempar revert kalau jalurnya rusak.
 * Jadi pertanyaan "apakah ini akan jalan" bisa dijawab tanpa membelanjakan gas dan
 * tanpa meninggalkan artefak di mainnet — dan token uji yang tidak sengaja lahir di
 * mainnet tidak bisa dihapus.
 *
 * DUA FACTORY, DUA PERTANYAAN
 *
 * `factory` adalah tempat pasar yang hidup lahir ($PARCEL di Monad, 0.11.0), jadi di sanalah
 * pasarnya dihitung. `launchFactory` adalah ADEXTO v1, tempat setiap peluncuran BARU terjadi,
 * jadi di sanalah bytecode-nya dicocokkan dan peluncurannya disimulasikan.
 *
 * Keluaran konsol berbahasa Inggris karena repo ini publik; komentar boleh Indonesia.
 *
 * Pakai:
 *   node scripts/probe.ts                 # Monad, bawaan
 *   node scripts/probe.ts 0g              # patokan yang sudah terbukti
 *   PROBE_FROM=0x… node scripts/probe.ts  # simulasi sebagai alamat tertentu
 */
import { ethers } from "ethers";
import { TARGETS, FACTORY_ABI, V1_RUNTIME_KECCAK, type ChainTarget } from "../src/chains.ts";

const key = (process.argv[2] ?? "monad").toLowerCase();
const target: ChainTarget | undefined = TARGETS[key];
if (!target) {
  console.error(`unknown target: ${key}. Options: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(target.rpcUrl, target.chainId, { staticNetwork: true, batchMaxCount: 1 });
const factory = new ethers.Contract(target.factory, FACTORY_ABI, provider);
const launchFactory = new ethers.Contract(target.launchFactory, FACTORY_ABI, provider);

console.log(`\n=== ${target.name} (chainId ${target.chainId}) ===`);

/**
 * `getBlockNumber()`, BUKAN `getNetwork()`.
 *
 * Provider ini dibuat dengan `staticNetwork: true`, jadi `getNetwork` menjawab dari
 * konfigurasi tanpa menyentuh jaringan sama sekali — pemeriksaan yang tidak bisa gagal,
 * dan itu lebih buruk daripada tidak ada pemeriksaan.
 */
const block = await provider.getBlockNumber();
console.log(`  RPC       ${target.rpcUrl}`);
console.log(`  block     ${block}`);

const drift: string[] = [];

// ── The factory the live markets were born on ──────────────────────────────────────────────
const code = await provider.getCode(target.factory);
if (code === "0x") {
  console.error(`  FATAL: no bytecode at ${target.factory}`);
  process.exit(1);
}
console.log(`\n  market factory ${target.factory}`);
console.log(`  bytecode  ${(code.length - 2) / 2} bytes`);

const onChain = await readFactory(factory);
if (onChain["VERSION"] && onChain["VERSION"] !== target.factoryVersion) {
  drift.push(`factoryVersion repo ${target.factoryVersion} != chain ${onChain["VERSION"]}`);
}
checkShared(onChain, "market factory");

// ── ADEXTO v1, where every new launch goes ─────────────────────────────────────────────────
const v1Code = await provider.getCode(target.launchFactory);
console.log(`\n  launch factory (ADEXTO v1) ${target.launchFactory}`);
if (v1Code === "0x") {
  drift.push(`no bytecode at launch factory ${target.launchFactory}`);
} else {
  const hash = ethers.keccak256(v1Code);
  console.log(`  bytecode  ${(v1Code.length - 2) / 2} bytes`);
  console.log(`  keccak    ${hash}  ${hash === V1_RUNTIME_KECCAK ? "ok" : "MISMATCH"}`);
  if (hash !== V1_RUNTIME_KECCAK) drift.push(`launch factory keccak ${hash} != ${V1_RUNTIME_KECCAK}`);
}
const v1 = await readFactory(launchFactory);
if (v1["VERSION"] !== target.launchFactoryVersion) {
  drift.push(`launchFactoryVersion repo ${target.launchFactoryVersion} != chain ${v1["VERSION"] ?? "unreadable"}`);
}
checkShared(v1, "launch factory");

console.log(`\n  config vs chain: ${drift.length === 0 ? "MATCH" : "DRIFT"}`);
for (const d of drift) console.log(`    - ${d}`);

/**
 * Simulasi `deployTrinity` terhadap factory v1, karena ke sanalah peluncuran baru pergi.
 *
 * Dua argumen di bawah pernah membuat probe ini revert, dan keduanya bukan salah
 * ketik melainkan salah paham terhadap kontraknya:
 *
 *   `initialSupply` bersatuan WHOLE TOKENS, bukan wei. `MAX_SUPPLY` adalah 1e12 whole
 *   tokens, jadi memasukkan `parseEther(...)` melampauinya dan ditolak dengan
 *   "Factory: bad supply".
 *
 *   `agentIdentity` TIDAK BOLEH alamat nol, bahkan ketika `bindAgent` bernilai false.
 *   Kontraknya menuntutnya lebih dulu, sebelum cabang pengikatan agent diperiksa,
 *   jadi launch tanpa agent tetap harus menyebut sebuah alamat. Kalau tidak:
 *   "Factory: zero agent".
 *
 * Pembagian fee mengikuti v1: kaki protokol 10 bps DIPOTONG DARI DALAM total, jadi
 * `creator + buyback + 10 <= swapFeeBps`. Pembagian 0.11.0 lama (50/50 dari 100) akan
 * ditolak di sini, dan itu memang perilaku yang benar.
 */
const caller = process.env["PROBE_FROM"] || ethers.Wallet.createRandom().address;
console.log(`\n  simulating deployTrinity on ADEXTO v1 as ${caller}`);

const args = [
  "Monad Probe",
  `MPRB${Math.floor(1000 + Math.random() * 9000)}`,
  1_000_000_000n, // whole tokens, not wei
  caller, // must not be address(0)
  ethers.parseEther("15000"), // virtualNative, in wei; virtual, never deposited
  100n, // swapFeeBps: the whole fee a trader pays
  70n, // creatorShareBps
  10n, // treasuryShareBps (buyback); depth = 100 - 70 - 10 - 10 protocol = 10
  ethers.ZeroHash,
  false, // bindAgent
  0n, // agentId, must be 0 when bindAgent is false
] as const;

let simulated = false;
try {
  const out = await launchFactory.deployTrinity!.staticCall(...args, { from: caller });
  console.log(`    staticCall   PASSED -> token ${out[0]}, curve ${out[1]}`);
  simulated = true;
} catch (e) {
  console.log(`    staticCall   REVERT: ${short(e)}`);
}

try {
  const gas = await launchFactory.deployTrinity!.estimateGas(...args, { from: caller });
  const fee = await provider.getFeeData();
  const line = fee.gasPrice
    ? `${gas} gas @ ${ethers.formatUnits(fee.gasPrice, "gwei")} gwei = ~${ethers.formatEther(gas * fee.gasPrice)} ${target.nativeSymbol}`
    : `${gas} gas`;
  console.log(`    estimateGas  ${line}`);
} catch (e) {
  console.log(`    estimateGas  FAILED: ${short(e)}`);
}

if (process.env["PROBE_FROM"]) {
  const bal = await provider.getBalance(process.env["PROBE_FROM"]);
  console.log(`\n  balance ${process.env["PROBE_FROM"]}`);
  console.log(`    ${ethers.formatEther(bal)} ${target.nativeSymbol}`);
}

console.log(
  `\n  verdict: launch path ${simulated ? "READY" : "NOT READY"}` +
    `, config ${drift.length === 0 ? "matches the chain" : "DRIFTS"}` +
    `, markets on the market factory ${onChain["totalProjectsCount"] ?? "?"}` +
    `, on ADEXTO v1 ${v1["totalProjectsCount"] ?? "?"}\n`,
);
process.exit(simulated && drift.length === 0 ? 0 : 1);

async function readFactory(f: ethers.Contract): Promise<Record<string, string>> {
  const reads: Array<[string, () => Promise<unknown>]> = [
    ["VERSION", () => f.VERSION!()],
    ["PROTOCOL_FEE_BPS", () => f.PROTOCOL_FEE_BPS!()],
    ["MAX_SUPPLY", () => f.MAX_SUPPLY!()],
    ["ANTI_SNIPER_BPS", () => f.ANTI_SNIPER_BPS!()],
    ["AGENT_REGISTRY", () => f.AGENT_REGISTRY!()],
    ["protocolTreasury", () => f.protocolTreasury!()],
    ["totalProjectsCount", () => f.totalProjectsCount!()],
  ];
  const out: Record<string, string> = {};
  for (const [name, call] of reads) {
    try {
      const v = await call();
      out[name] = String(v);
      console.log(`  ${name.padEnd(19)} ${v}`);
    } catch (e) {
      console.log(`  ${name.padEnd(19)} FAILED: ${short(e)}`);
    }
  }
  return out;
}

// Konfigurasi yang ditulis di repo harus cocok dengan chain, bukan sekadar terlihat wajar.
function checkShared(values: Record<string, string>, label: string): void {
  if (values["AGENT_REGISTRY"] && !eq(values["AGENT_REGISTRY"], target!.agentRegistry)) {
    drift.push(`${label}: agentRegistry repo ${target!.agentRegistry} != chain ${values["AGENT_REGISTRY"]}`);
  }
  if (values["protocolTreasury"] && !eq(values["protocolTreasury"], target!.protocolTreasury)) {
    drift.push(`${label}: protocolTreasury repo ${target!.protocolTreasury} != chain ${values["protocolTreasury"]}`);
  }
}
function short(e: unknown): string {
  const anyE = e as { shortMessage?: string; message?: string };
  return String(anyE?.shortMessage ?? anyE?.message ?? e).slice(0, 180);
}
function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
