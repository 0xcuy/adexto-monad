/**
 * Registry chain untuk kaki pengiriman.
 *
 * KENAPA BERKAS INI ADA, DAN KENAPA ISINYA BUKAN SATU CHAIN
 *
 * Worker x402 yang sudah berjalan hanya bisa mengantar di satu chain: konfigurasinya
 * memuat `OG_RPC` dan tidak ada yang lain, jadi 0G bukan pilihan melainkan satu-satunya
 * tujuan yang bisa diucapkan. Menambahkan Monad dengan menyalin variabel itu menjadi
 * `MONAD_RPC` akan bekerja untuk dua chain lalu gagal pada chain ketiga, dan yang
 * membusuk bukan kodenya melainkan asumsinya — bahwa jumlah tujuan diketahui saat
 * berkas konfigurasi ditulis.
 *
 * Jadi tujuan menjadi DATA, dan penambahan chain berikutnya adalah satu entri di sini.
 *
 * ALAMAT DI BAWAH DIBACA DARI CHAIN, BUKAN DISALIN DARI CATATAN
 *
 * Setiap nilai `factory` sudah dipanggil `VERSION`-nya dan dicocokkan dengan ukuran
 * bytecode-nya. Itu bukan kehati-hatian berlebihan: satu alamat yang sama muncul di
 * dua chain dalam proyek ini — deployer dan nonce yang sama menghasilkan alamat yang
 * sama — sehingga menebak dari catatan lama bisa menunjuk kontrak yang berbeda peran.
 */

export interface ChainTarget {
  /** Kunci pendek untuk dipakai di jalur URL dan log. */
  key: string;
  chainId: number;
  name: string;
  /** Simbol aset gas. Inilah yang dibelanjakan untuk mengisi pesanan. */
  nativeSymbol: string;
  rpcUrl: string;
  /**
   * Explorer yang BENAR-BENAR menjawab.
   *
   * `monadvision.com` sempat dipakai di seluruh proyek induk dan membalas HTTP 403,
   * termasuk dengan User-Agent peramban sungguhan. Tautan verifikasi yang tidak bisa
   * dibuka lebih merusak daripada tidak ada tautan: pembaca menyimpulkan alamatnya
   * palsu, bukan explorer-nya yang menolak.
   */
  explorer: string;
  /** AdextoFactory generasi aktif. Sudah diverifikasi ke chain. */
  factory: string;
  /** `VERSION` yang dibaca dari kontrak di alamat di atas. */
  factoryVersion: string;
  /** Registry identitas ERC-8004 yang dipakai factory saat mengikat agent. */
  agentRegistry: string;
  /** Penerima kaki fee protokol. */
  protocolTreasury: string;
}

export const MONAD: ChainTarget = {
  key: "monad",
  chainId: 143,
  name: "Monad Mainnet",
  nativeSymbol: "MON",
  rpcUrl: "https://rpc.monad.xyz",
  explorer: "https://monadscan.com",
  factory: "0x5800e9715a47a598fce9bc3B65a95FD6BeBf76A3",
  factoryVersion: "0.11.0",
  agentRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  protocolTreasury: "0x24268Fffc119ec5550F68e80D94476fD64daE967",
};

/**
 * 0G ikut didaftarkan, dan itu disengaja.
 *
 * Ia adalah satu-satunya tujuan yang jalur pembayarannya sudah TERBUKTI dengan dana
 * sungguhan, jadi ia berfungsi sebagai patokan: setiap klaim tentang Monad bisa
 * dibandingkan dengan pengukuran yang benar-benar terjadi, bukan dengan harapan.
 * Membuangnya akan menghapus satu-satunya angka pembanding yang dimiliki proyek ini.
 */
export const ZEROG: ChainTarget = {
  key: "0g",
  chainId: 16661,
  name: "0G Mainnet",
  nativeSymbol: "0G",
  rpcUrl: "https://evmrpc.0g.ai",
  explorer: "https://chainscan.0g.ai",
  factory: "0x51c4168226463F7e5A141e1c6D30520734BC840a",
  factoryVersion: "0.11.0",
  agentRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  protocolTreasury: "0x24268Fffc119ec5550F68e80D94476fD64daE967",
};

export const TARGETS: Record<string, ChainTarget> = {
  [MONAD.key]: MONAD,
  [ZEROG.key]: ZEROG,
};

export function targetByChainId(chainId: number): ChainTarget | undefined {
  return Object.values(TARGETS).find((t) => t.chainId === chainId);
}

/**
 * Kaki pembayaran. TIDAK ikut menjadi data seperti tujuan di atas, dan itu bukan
 * kelalaian: skema `exact` x402 yang dipakai di sini bersandar pada EIP-3009, dan
 * yang mengimplementasikannya adalah USDC Circle. Memperlakukan aset pembayaran
 * sebagai daftar yang bisa ditambah akan menyiratkan token mana pun bisa dipakai,
 * padahal yang menandatangani dan memeriksa otorisasinya adalah kontrak tertentu.
 */
export const PAYMENT = {
  chainId: 8453,
  network: "base",
  name: "Base Mainnet",
  explorer: "https://basescan.org",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  usdcDecimals: 6,
  /** Dibaca dari kontrak saat verifikasi; nilai di sini hanya petunjuk bagi klien. */
  eip712Name: "USD Coin",
  eip712Version: "2",
} as const;

/** ABI minimum yang dipanggil kaki pengiriman. Sengaja sesempit mungkin. */
export const CURVE_ABI = [
  "function getBuyQuote(uint256 nativeIn) view returns (uint256,uint256,uint256,uint256,uint256)",
  "function buy(uint256 minTokensOut,address to,uint256 deadline) payable returns (uint256)",
] as const;

export const FACTORY_ABI = [
  "function VERSION() view returns (string)",
  "function PROTOCOL_FEE_BPS() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function ANTI_SNIPER_BPS() view returns (uint256)",
  "function AGENT_REGISTRY() view returns (address)",
  "function protocolTreasury() view returns (address)",
  "function totalProjectsCount() view returns (uint256)",
  "function deployTrinity(string name,string symbol,uint256 initialSupply,address agentIdentity,uint256 virtualNative,uint256 swapFeeBps,uint256 creatorShareBps,uint256 treasuryShareBps,bytes32 metadataRoot,bool bindAgent,uint256 agentId) returns (address,address)",
] as const;
