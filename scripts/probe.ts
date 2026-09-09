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
 * Pakai:
 *   node scripts/probe.ts                 # Monad, bawaan
 *   node scripts/probe.ts 0g              # patokan yang sudah terbukti
 *   PROBE_FROM=0x… node scripts/probe.ts  # simulasi sebagai alamat tertentu
 */
import { ethers } from "ethers";
import { TARGETS, FACTORY_ABI, type ChainTarget } from "../src/chains.ts";

const key = (process.argv[2] ?? "monad").toLowerCase();
const target: ChainTarget | undefined = TARGETS[key];
if (!target) {
  console.error(`tujuan tidak dikenal: ${key}. Pilihan: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(target.rpcUrl, target.chainId, { staticNetwork: true });
const factory = new ethers.Contract(target.factory, FACTORY_ABI, provider);

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

const code = await provider.getCode(target.factory);
if (code === "0x") {
  console.error(`  FATAL: tidak ada bytecode di ${target.factory}`);
  process.exit(1);
}
console.log(`\n  factory   ${target.factory}`);
console.log(`  bytecode  ${(code.length - 2) / 2} byte`);

const reads: Array<[string, () => Promise<unknown>]> = [
  ["VERSION", () => factory.VERSION!()],
  ["PROTOCOL_FEE_BPS", () => factory.PROTOCOL_FEE_BPS!()],
  ["MAX_SUPPLY", () => factory.MAX_SUPPLY!()],
  ["ANTI_SNIPER_BPS", () => factory.ANTI_SNIPER_BPS!()],
  ["AGENT_REGISTRY", () => factory.AGENT_REGISTRY!()],
  ["protocolTreasury", () => factory.protocolTreasury!()],
  ["totalProjectsCount", () => factory.totalProjectsCount!()],
];
const onChain: Record<string, string> = {};
for (const [name, call] of reads) {
  try {
    const v = await call();
    onChain[name] = String(v);
    console.log(`  ${name.padEnd(19)} ${v}`);
  } catch (e) {
    console.log(`  ${name.padEnd(19)} GAGAL: ${short(e)}`);
  }
}

// Konfigurasi yang ditulis di repo harus cocok dengan chain, bukan sekadar terlihat wajar.
const drift: string[] = [];
if (onChain["VERSION"] && onChain["VERSION"] !== target.factoryVersion) {
  drift.push(`factoryVersion repo ${target.factoryVersion} != chain ${onChain["VERSION"]}`);
}
if (onChain["AGENT_REGISTRY"] && !eq(onChain["AGENT_REGISTRY"], target.agentRegistry)) {
  drift.push(`agentRegistry repo ${target.agentRegistry} != chain ${onChain["AGENT_REGISTRY"]}`);
}
if (onChain["protocolTreasury"] && !eq(onChain["protocolTreasury"], target.protocolTreasury)) {
  drift.push(`protocolTreasury repo ${target.protocolTreasury} != chain ${onChain["protocolTreasury"]}`);
}
console.log(`\n  konfigurasi vs chain: ${drift.length === 0 ? "COCOK" : "MENYIMPANG"}`);
for (const d of drift) console.log(`    - ${d}`);

/**
 * Simulasi `deployTrinity`.
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
 */
const caller = process.env["PROBE_FROM"] || ethers.Wallet.createRandom().address;
console.log(`\n  simulasi deployTrinity sebagai ${caller}`);

const args = [
  "Metropolis Probe",
  "MPROBE",
  1_000_000_000n, // whole tokens, bukan wei
  caller, // wajib bukan address(0)
  ethers.parseEther("15000"), // virtualNative, wei
  100n, // swapFeeBps, + PROTOCOL_FEE_BPS harus <= 500
  50n, // creatorShareBps
  50n, // treasuryShareBps, creator + treasury harus <= swapFeeBps
  ethers.ZeroHash,
  false, // bindAgent
  0n, // agentId, harus 0 kalau bindAgent false
] as const;

let simulated = false;
try {
  const out = await factory.deployTrinity!.staticCall(...args, { from: caller });
  console.log(`    staticCall   LOLOS -> token ${out[0]}, curve ${out[1]}`);
  simulated = true;
} catch (e) {
  console.log(`    staticCall   REVERT: ${short(e)}`);
}

try {
  const gas = await factory.deployTrinity!.estimateGas(...args, { from: caller });
  const fee = await provider.getFeeData();
  const line = fee.gasPrice
    ? `${gas} gas @ ${ethers.formatUnits(fee.gasPrice, "gwei")} gwei = ~${ethers.formatEther(gas * fee.gasPrice)} ${target.nativeSymbol}`
    : `${gas} gas`;
  console.log(`    estimateGas  ${line}`);
} catch (e) {
  console.log(`    estimateGas  GAGAL: ${short(e)}`);
}

if (process.env["PROBE_FROM"]) {
  const bal = await provider.getBalance(process.env["PROBE_FROM"]);
  console.log(`\n  saldo ${process.env["PROBE_FROM"]}`);
  console.log(`    ${ethers.formatEther(bal)} ${target.nativeSymbol}`);
}

console.log(
  `\n  kesimpulan: jalur launch ${simulated ? "SIAP" : "BELUM SIAP"}` +
    `, pasar terdaftar sekarang ${onChain["totalProjectsCount"] ?? "?"}\n`,
);

function short(e: unknown): string {
  const anyE = e as { shortMessage?: string; message?: string };
  return String(anyE?.shortMessage ?? anyE?.message ?? e).slice(0, 180);
}
function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
