// WebGPU-accelerated equity calculator
// Uses compute shaders to massively parallelize Monte Carlo simulations
// Designed for NVIDIA RTX 4070 Ti Super (7168 CUDA cores)

import { CardIndex } from './types';
import { ALL_COMBOS } from './ranges';

// WebGPU compute shader for equity calculation
const EQUITY_SHADER = `
// Card evaluation compute shader
// Each workgroup processes one hero hand against many villain hands

struct Params {
  numVillainCombos: u32,
  numSimsPerMatchup: u32,
  numBoardCards: u32,
  seed: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> heroCombos: array<u32>;      // [card1, card2] pairs
@group(0) @binding(2) var<storage, read> villainCombos: array<u32>;   // [card1, card2, weight] triples
@group(0) @binding(3) var<storage, read> board: array<u32>;           // board cards
@group(0) @binding(4) var<storage, read_write> results: array<f32>;   // equity results

// Fast hash for PRNG
fn xorshift(state: ptr<function, u32>) -> u32 {
  var s = *state;
  s ^= s << 13u;
  s ^= s >> 17u;
  s ^= s << 5u;
  *state = s;
  return s;
}

fn randFloat(state: ptr<function, u32>) -> f32 {
  return f32(xorshift(state)) / 4294967296.0;
}

// Rank prime mapping for hand evaluation
fn rankPrime(rank: u32) -> u32 {
  let primes = array<u32, 13>(2u, 3u, 5u, 7u, 11u, 13u, 17u, 19u, 23u, 29u, 31u, 37u, 41u);
  return primes[rank];
}

fn cardRank(card: u32) -> u32 {
  return card / 4u;
}

fn cardSuit(card: u32) -> u32 {
  return card % 4u;
}

// Simplified 5-card hand evaluator for GPU
// Returns a comparable score (higher = better)
fn evaluateHand5(c0: u32, c1: u32, c2: u32, c3: u32, c4: u32) -> u32 {
  var ranks = array<u32, 5>(cardRank(c0), cardRank(c1), cardRank(c2), cardRank(c3), cardRank(c4));
  var suits = array<u32, 5>(cardSuit(c0), cardSuit(c1), cardSuit(c2), cardSuit(c3), cardSuit(c4));

  // Sort ranks descending (bubble sort for 5 elements)
  for (var i = 0u; i < 4u; i++) {
    for (var j = 0u; j < 4u - i; j++) {
      if (ranks[j] < ranks[j + 1u]) {
        let tmp = ranks[j];
        ranks[j] = ranks[j + 1u];
        ranks[j + 1u] = tmp;
        let stmp = suits[j];
        suits[j] = suits[j + 1u];
        suits[j + 1u] = stmp;
      }
    }
  }

  // Check flush
  let isFlush = suits[0] == suits[1] && suits[1] == suits[2] && suits[2] == suits[3] && suits[3] == suits[4];

  // Check straight
  var isStraight = false;
  var straightHigh = 0u;
  if (ranks[0] - ranks[4] == 4u && ranks[0] != ranks[1] && ranks[1] != ranks[2] && ranks[2] != ranks[3] && ranks[3] != ranks[4]) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // Wheel: A-2-3-4-5
  if (ranks[0] == 12u && ranks[1] == 3u && ranks[2] == 2u && ranks[3] == 1u && ranks[4] == 0u) {
    isStraight = true;
    straightHigh = 3u; // 5-high straight
  }

  // Count rank occurrences
  var counts = array<u32, 13>();
  for (var i = 0u; i < 5u; i++) {
    counts[ranks[i]] += 1u;
  }

  var quads = 0u;
  var trips = 0u;
  var pairs = 0u;
  var quadRank = 0u;
  var tripRank = 0u;
  var pairRank1 = 0u;
  var pairRank2 = 0u;

  for (var r = 12u; r < 13u; r--) {
    if (counts[r] == 4u) { quads++; quadRank = r; }
    if (counts[r] == 3u) { trips++; tripRank = r; }
    if (counts[r] == 2u) {
      pairs++;
      if (pairs == 1u) { pairRank1 = r; }
      else { pairRank2 = r; }
    }
    if (r == 0u) { break; }
  }

  // Classify hand and compute score
  // Score format: category * 1000000 + tiebreaker
  if (isFlush && isStraight) { return 8000000u + straightHigh * 100u; }
  if (quads > 0u) { return 7000000u + quadRank * 100u; }
  if (trips > 0u && pairs > 0u) { return 6000000u + tripRank * 100u + pairRank1; }
  if (isFlush) { return 5000000u + ranks[0] * 10000u + ranks[1] * 1000u + ranks[2] * 100u + ranks[3] * 10u + ranks[4]; }
  if (isStraight) { return 4000000u + straightHigh * 100u; }
  if (trips > 0u) { return 3000000u + tripRank * 10000u + ranks[0] * 100u; }
  if (pairs >= 2u) { return 2000000u + pairRank1 * 10000u + pairRank2 * 100u; }
  if (pairs == 1u) { return 1000000u + pairRank1 * 10000u + ranks[0] * 100u; }
  return ranks[0] * 10000u + ranks[1] * 1000u + ranks[2] * 100u + ranks[3] * 10u + ranks[4];
}

// Evaluate best 5 of 7 cards
fn evaluate7(cards: array<u32, 7>) -> u32 {
  var best = 0u;
  // C(7,5) = 21 combinations - skip each pair
  for (var i = 0u; i < 7u; i++) {
    for (var j = i + 1u; j < 7u; j++) {
      var hand = array<u32, 5>();
      var idx = 0u;
      for (var k = 0u; k < 7u; k++) {
        if (k != i && k != j) {
          hand[idx] = cards[k];
          idx++;
        }
      }
      let score = evaluateHand5(hand[0], hand[1], hand[2], hand[3], hand[4]);
      if (score > best) { best = score; }
    }
  }
  return best;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let heroIdx = gid.x;
  if (heroIdx >= arrayLength(&heroCombos) / 2u) { return; }

  let heroCard1 = heroCombos[heroIdx * 2u];
  let heroCard2 = heroCombos[heroIdx * 2u + 1u];

  var wins = 0.0;
  var total = 0.0;
  var rngState = params.seed ^ (heroIdx * 2654435761u);

  let numBoard = params.numBoardCards;
  let cardsNeeded = 5u - numBoard;

  for (var vi = 0u; vi < params.numVillainCombos; vi++) {
    let villainCard1 = villainCombos[vi * 3u];
    let villainCard2 = villainCombos[vi * 3u + 1u];

    // Check card conflicts
    if (heroCard1 == villainCard1 || heroCard1 == villainCard2 ||
        heroCard2 == villainCard1 || heroCard2 == villainCard2) {
      continue;
    }

    // Check board conflicts
    var conflict = false;
    for (var bi = 0u; bi < numBoard; bi++) {
      if (board[bi] == villainCard1 || board[bi] == villainCard2) {
        conflict = true;
        break;
      }
    }
    if (conflict) { continue; }

    for (var sim = 0u; sim < params.numSimsPerMatchup; sim++) {
      // Build 7-card hands by dealing remaining cards
      var allCards = array<u32, 52>();
      var usedCount = 0u;

      // Mark used cards
      var used = array<u32, 52>();
      used[heroCard1] = 1u;
      used[heroCard2] = 1u;
      used[villainCard1] = 1u;
      used[villainCard2] = 1u;
      for (var bi = 0u; bi < numBoard; bi++) {
        used[board[bi]] = 1u;
      }

      // Build available deck
      var availCount = 0u;
      for (var c = 0u; c < 52u; c++) {
        if (used[c] == 0u) {
          allCards[availCount] = c;
          availCount++;
        }
      }

      // Fisher-Yates partial shuffle for needed cards
      for (var i = 0u; i < cardsNeeded; i++) {
        let j = i + (xorshift(&rngState) % (availCount - i));
        let tmp = allCards[i];
        allCards[i] = allCards[j];
        allCards[j] = tmp;
      }

      // Build full boards for both hands
      var heroHand = array<u32, 7>();
      var villainHand = array<u32, 7>();

      heroHand[0] = heroCard1;
      heroHand[1] = heroCard2;
      villainHand[0] = villainCard1;
      villainHand[1] = villainCard2;

      for (var bi = 0u; bi < numBoard; bi++) {
        heroHand[2u + bi] = board[bi];
        villainHand[2u + bi] = board[bi];
      }
      for (var ci = 0u; ci < cardsNeeded; ci++) {
        heroHand[2u + numBoard + ci] = allCards[ci];
        villainHand[2u + numBoard + ci] = allCards[ci];
      }

      let heroScore = evaluate7(heroHand);
      let villainScore = evaluate7(villainHand);

      if (heroScore > villainScore) { wins += 1.0; }
      else if (heroScore == villainScore) { wins += 0.5; }
      total += 1.0;
    }
  }

  if (total > 0.0) {
    results[heroIdx] = wins / total;
  } else {
    results[heroIdx] = 0.5;
  }
}
`;

export class GPUEquityCalculator {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private initialized: boolean = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      if (!navigator.gpu) {
        console.warn('WebGPU not available, falling back to CPU');
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        console.warn('No GPU adapter found');
        return false;
      }

      // Log adapter info
      const info = adapter.info;
      console.log(`GPU: ${info.vendor} ${info.architecture} ${info.description}`);

      this.device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: 256 * 1024 * 1024, // 256MB
          maxBufferSize: 256 * 1024 * 1024,
          maxComputeWorkgroupsPerDimension: 65535,
        },
      });

      // Create shader module
      const shaderModule = this.device.createShaderModule({
        code: EQUITY_SHADER,
      });

      // Create compute pipeline
      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });

      this.initialized = true;
      return true;
    } catch (e) {
      console.warn('WebGPU initialization failed:', e);
      return false;
    }
  }

  async calculateEquity(
    heroCombos: { card1: number; card2: number }[],
    villainCombos: { card1: number; card2: number; weight: number }[],
    board: number[],
    simsPerMatchup: number = 100,
    seed: number = 42,
  ): Promise<Float32Array> {
    if (!this.device || !this.pipeline) {
      throw new Error('GPU not initialized');
    }

    const numHero = heroCombos.length;
    const numVillain = villainCombos.length;

    // Create buffers
    const paramsData = new Uint32Array([numVillain, simsPerMatchup, board.length, seed]);
    const paramsBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Hero combos buffer
    const heroData = new Uint32Array(numHero * 2);
    for (let i = 0; i < numHero; i++) {
      heroData[i * 2] = heroCombos[i].card1;
      heroData[i * 2 + 1] = heroCombos[i].card2;
    }
    const heroBuffer = this.device.createBuffer({
      size: heroData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(heroBuffer, 0, heroData);

    // Villain combos buffer
    const villainData = new Uint32Array(numVillain * 3);
    for (let i = 0; i < numVillain; i++) {
      villainData[i * 3] = villainCombos[i].card1;
      villainData[i * 3 + 1] = villainCombos[i].card2;
      villainData[i * 3 + 2] = Math.round(villainCombos[i].weight * 1000);
    }
    const villainBuffer = this.device.createBuffer({
      size: villainData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(villainBuffer, 0, villainData);

    // Board buffer
    const boardData = new Uint32Array(Math.max(5, board.length));
    for (let i = 0; i < board.length; i++) boardData[i] = board[i];
    const boardBuffer = this.device.createBuffer({
      size: boardData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(boardBuffer, 0, boardData);

    // Results buffer
    const resultBuffer = this.device.createBuffer({
      size: numHero * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Staging buffer for readback
    const stagingBuffer = this.device.createBuffer({
      size: numHero * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: heroBuffer } },
        { binding: 2, resource: { buffer: villainBuffer } },
        { binding: 3, resource: { buffer: boardBuffer } },
        { binding: 4, resource: { buffer: resultBuffer } },
      ],
    });

    // Dispatch compute
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numHero / 64));
    passEncoder.end();

    // Copy results to staging buffer
    commandEncoder.copyBufferToBuffer(resultBuffer, 0, stagingBuffer, 0, numHero * 4);
    this.device.queue.submit([commandEncoder.finish()]);

    // Read results
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const resultData = new Float32Array(stagingBuffer.getMappedRange().slice(0));
    stagingBuffer.unmap();

    // Cleanup
    paramsBuffer.destroy();
    heroBuffer.destroy();
    villainBuffer.destroy();
    boardBuffer.destroy();
    resultBuffer.destroy();
    stagingBuffer.destroy();

    return resultData;
  }

  destroy() {
    this.device?.destroy();
    this.device = null;
    this.pipeline = null;
    this.initialized = false;
  }
}

// Singleton instance
let gpuCalcInstance: GPUEquityCalculator | null = null;

export async function getGPUCalculator(): Promise<GPUEquityCalculator | null> {
  if (gpuCalcInstance) return gpuCalcInstance;

  gpuCalcInstance = new GPUEquityCalculator();
  const success = await gpuCalcInstance.initialize();

  if (!success) {
    gpuCalcInstance = null;
    return null;
  }

  return gpuCalcInstance;
}
