import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { DEFAULT_CONFIG } from './engine/config'
import { parseConfig, serializeConfig } from './engine/configIO'
import { spinBaseGame } from './engine/baseGame'
import {
  createFeatureSession,
  stepFeatureSession,
} from './engine/featureEngine'
import { createSeededRng } from './engine/rng'
import { runSimulation } from './engine/simulation'
import {
  DEFAULT_TUNING_TARGETS,
  describeMetricStatus,
  runTuningSweep,
  type TargetRange,
  type TuningSweepResult,
  type TuningTargets,
} from './engine/tuning'
import type {
  BaseSpinResult,
  GameConfig,
  SimulationResult,
  SymbolId,
} from './engine/types'
import type {
  FeatureReveal,
  FeatureSession,
  RevealedFeatureTile,
  TileRarity,
} from './engine/featureTypes'

const SYMBOL_DISPLAY: Record<string, { icon: string; label: string }> = {
  trexTooth: { icon: '', label: 'T-Rex Tooth' },
  raptorClaw: { icon: '', label: 'Raptor Claw' },
  triceratopsEggshell: { icon: '', label: 'Eggshell' },
  pterosaurFeather: { icon: '', label: 'Pterosaur Feather' },
  sauropodHorn: { icon: '', label: 'Horn Fragment' },
  campWild: { icon: '', label: 'Expedition Camp' },
  goldenAmber: { icon: '', label: 'Golden Amber' },
  compass: { icon: '⌖', label: 'Compass' },
  brush: { icon: '╱', label: 'Brush' },
  journal: { icon: '▤', label: 'Journal' },
  pickaxe: { icon: '⚒', label: 'Pickaxe' },
  canteen: { icon: '◉', label: 'Canteen' },
  jeep: { icon: '▣', label: 'Jeep' },
  helicopter: { icon: '✣', label: 'Helicopter' },
  scientist: { icon: '♟', label: 'Scientist' },
  map: { icon: '◇', label: 'Satellite Map' },
  crate: { icon: '▦', label: 'Supply Crate' },
  footprint: { icon: '♣', label: 'Footprint' },
}

const DISCOVERY_PRESENTATION: Record<
  string,
  { displayName: string; icon: string; rarity: TileRarity }
> = {
  fern: { displayName: 'Fern', icon: '❧', rarity: 'common' },
  river: { displayName: 'River', icon: '≋', rarity: 'common' },
  amber: { displayName: 'Amber', icon: '◆', rarity: 'common' },
  'small-fossil': { displayName: 'Small Fossil', icon: '◉', rarity: 'common' },
  footprints: { displayName: 'Footprints', icon: '♣', rarity: 'common' },
  'bone-cluster': { displayName: 'Bone Cluster', icon: '✣', rarity: 'uncommon' },
  'dinosaur-egg': { displayName: 'Dinosaur Egg', icon: '◯', rarity: 'uncommon' },
  nest: { displayName: 'Nest', icon: '⌁', rarity: 'uncommon' },
  'complete-skeleton': {
    displayName: 'Complete Skeleton',
    icon: '☠',
    rarity: 'rare',
  },
  'living-specimen': {
    displayName: 'Living Specimen',
    icon: '◢',
    rarity: 'rare',
  },
  'new-species': { displayName: 'New Species', icon: '★', rarity: 'legendary' },
}

function discoveryPresentation(tile: RevealedFeatureTile) {
  return (
    DISCOVERY_PRESENTATION[tile.id] ?? {
      displayName: tile.displayName,
      icon: '?',
      rarity: 'common' as const,
    }
  )
}

const FIELD_NOTE_SYMBOLS = [
  'trexTooth',
  'raptorClaw',
  'triceratopsEggshell',
  'pterosaurFeather',
  'sauropodHorn',
] as const

const CONCEPT_SYMBOL_ASSETS: Record<string, string> = {
  compass: new URL('./assets/concept/compass.png', import.meta.url).href,
  brush: new URL('./assets/concept/brush.png', import.meta.url).href,
  journal: new URL('./assets/concept/journal.png', import.meta.url).href,
  pickaxe: new URL('./assets/concept/pickaxe.png', import.meta.url).href,
  canteen: new URL('./assets/concept/canteen.png', import.meta.url).href,
  jeep: new URL('./assets/concept/jeep.png', import.meta.url).href,
  helicopter: new URL('./assets/concept/helicopter.png', import.meta.url).href,
  scientist: new URL('./assets/concept/scientist.png', import.meta.url).href,
  map: new URL('./assets/concept/map.png', import.meta.url).href,
  crate: new URL('./assets/concept/crate.png', import.meta.url).href,
  footprint: new URL('./assets/concept/footprint.png', import.meta.url).href,
  campWild: new URL('./assets/concept/campWild.png', import.meta.url).href,
  goldenAmber: new URL('./assets/concept/goldenAmber.png', import.meta.url).href,
  trexTooth: new URL('./assets/concept/trexTooth.png', import.meta.url).href,
  raptorClaw: new URL('./assets/concept/raptorClaw.png', import.meta.url).href,
  triceratopsEggshell: new URL(
    './assets/concept/triceratopsEggshell.png',
    import.meta.url,
  ).href,
  pterosaurFeather: new URL('./assets/concept/pterosaurFeather.png', import.meta.url)
    .href,
  sauropodHorn: new URL('./assets/concept/sauropodHorn.png', import.meta.url).href,
}

const CONCEPT_DISCOVERY_ASSETS: Record<string, string> = {
  fern: new URL('./assets/concept/fern.png', import.meta.url).href,
  river: new URL('./assets/concept/river.png', import.meta.url).href,
  amber: new URL('./assets/concept/amber.png', import.meta.url).href,
  footprints: new URL('./assets/concept/footprint.png', import.meta.url).href,
  'small-fossil': new URL('./assets/concept/small-fossil.png', import.meta.url).href,
  'bone-cluster': new URL('./assets/concept/bone-cluster.png', import.meta.url).href,
  'dinosaur-egg': new URL('./assets/concept/dinosaur-egg.png', import.meta.url).href,
  nest: new URL('./assets/concept/dinosaur-egg.png', import.meta.url).href,
  'complete-skeleton': new URL('./assets/concept/complete-skeleton.png', import.meta.url)
    .href,
  'living-specimen': new URL('./assets/concept/living-specimen.png', import.meta.url)
    .href,
  'new-species': new URL('./assets/concept/living-specimen.png', import.meta.url).href,
}

function ConceptImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  return <img className={`concept-art ${className}`} src={src} alt={alt} draggable={false} />
}

function SymbolIllustration({ symbol }: { symbol: string }) {
  const asset = CONCEPT_SYMBOL_ASSETS[symbol]
  if (asset) {
    return (
      <ConceptImage
        src={asset}
        alt={SYMBOL_DISPLAY[symbol]?.label ?? symbol}
        className={`concept-symbol concept-${symbol}`}
      />
    )
  }

  const shared = {
    viewBox: '0 0 64 64',
    role: 'img',
    'aria-hidden': true,
    focusable: false,
  } as const

  switch (symbol) {
    case 'trexTooth':
      return (
        <svg {...shared} className="symbol-svg symbol-evidence">
          <path className="filled" d="M34 5c8 15 10 31 4 53-10-15-16-28-12-43 1-5 4-8 8-10z" />
          <path d="M31 17c4 5 5 15 2 29M25 15c5 3 10 3 15 0" />
        </svg>
      )
    case 'raptorClaw':
      return (
        <svg {...shared} className="symbol-svg symbol-evidence">
          <path className="filled" d="M45 7c1 18-7 35-26 50 5-20 11-36 26-50z" />
          <path d="M37 20c-5 6-8 14-10 24M18 51c7 1 13-1 18-6" />
        </svg>
      )
    case 'triceratopsEggshell':
      return (
        <svg {...shared} className="symbol-svg symbol-evidence">
          <path className="filled" d="M17 34c0-12 7-24 15-29 8 5 15 17 15 29 0 14-6 23-15 23s-15-9-15-23z" />
          <path d="m18 35 8-7 7 8 7-8 7 7M25 48c5 2 9 2 14 0" />
        </svg>
      )
    case 'pterosaurFeather':
      return (
        <svg {...shared} className="symbol-svg symbol-evidence">
          <path className="filled" d="M50 8C30 11 16 26 13 56c18-7 33-22 37-48z" />
          <path d="M47 12 14 55M25 42l-8-1M33 32l-10-2M40 23l-10-2M27 44l2 8M36 34l4 9M43 24l4 7" />
        </svg>
      )
    case 'sauropodHorn':
      return (
        <svg {...shared} className="symbol-svg symbol-evidence">
          <path className="filled" d="M11 42c17 0 32-11 43-34-2 28-17 45-43 45z" />
          <path d="M17 42c10-2 20-9 30-24M20 51c4-2 6-5 6-9" />
        </svg>
      )
    case 'campWild':
      return (
        <svg {...shared} className="symbol-svg symbol-wild">
          <path className="filled" d="M14 49 32 14l18 35z" />
          <path d="M32 14v35M22 49h20M13 55h38M20 28h24" />
          <path d="M11 18c8 4 14 4 21 0s13-4 21 0" />
        </svg>
      )
    case 'compass':
      return (
        <svg {...shared} className="symbol-svg symbol-compass">
          <circle cx="32" cy="32" r="22" />
          <circle cx="32" cy="32" r="4" />
          <path d="M32 8v7M32 49v7M8 32h7M49 32h7" />
          <path className="filled" d="M38 17 34 35 20 45 28 28z" />
        </svg>
      )
    case 'brush':
      return (
        <svg {...shared} className="symbol-svg symbol-brush">
          <path d="M43 9 55 21 27 49 15 37z" />
          <path className="filled" d="M12 40c7 1 12 6 13 12-7 3-14 2-18-3 4-1 5-4 5-9z" />
          <path d="M38 14 50 26" />
        </svg>
      )
    case 'journal':
      return (
        <svg {...shared} className="symbol-svg symbol-journal">
          <path className="filled" d="M16 9h28c4 0 7 3 7 7v39H20c-5 0-8-3-8-8V14c0-3 2-5 4-5z" />
          <path d="M21 15v34M28 24h15M28 33h12M28 42h16" />
          <path d="M44 9v46" />
        </svg>
      )
    case 'pickaxe':
      return (
        <svg {...shared} className="symbol-svg symbol-pickaxe">
          <path d="M16 19c12-9 28-10 39-2" />
          <path d="M40 17 17 52" />
          <path d="M28 35 43 50" />
        </svg>
      )
    case 'canteen':
      return (
        <svg {...shared} className="symbol-svg symbol-canteen">
          <path d="M25 10h14v8H25z" />
          <path className="filled" d="M21 18h22c6 5 10 12 10 22 0 12-8 18-21 18s-21-6-21-18c0-10 4-17 10-22z" />
          <path d="M22 29c7 4 14 4 21 0M32 10V5" />
        </svg>
      )
    case 'jeep':
      return (
        <svg {...shared} className="symbol-svg symbol-jeep">
          <path className="filled" d="M9 34h8l6-12h18l8 12h6v13H9z" />
          <path d="M25 23v11M41 23v11M18 47a6 6 0 1 0 0 .1M47 47a6 6 0 1 0 0 .1" />
          <path d="M18 34h36" />
        </svg>
      )
    case 'helicopter':
      return (
        <svg {...shared} className="symbol-svg symbol-helicopter">
          <path d="M9 15h45M32 15v8" />
          <path className="filled" d="M18 29h23c8 0 12 5 12 10H27c-7 0-11-4-11-8 0-1 1-2 2-2z" />
          <path d="M44 30 56 24M27 39v8M21 47h19" />
        </svg>
      )
    case 'scientist':
      return (
        <svg {...shared} className="symbol-svg symbol-scientist">
          <circle className="filled" cx="32" cy="17" r="9" />
          <path d="M20 55 25 29h14l5 26" />
          <path d="M25 35h14M22 20h20M31 29l-7 26M33 29l7 26" />
        </svg>
      )
    case 'map':
      return (
        <svg {...shared} className="symbol-svg symbol-map">
          <path className="filled" d="M10 17 24 11l16 6 14-5v35l-14 6-16-6-14 5z" />
          <path d="M24 11v36M40 17v36M16 24c8 4 16 5 28 0M17 40c9-4 18-3 29 1" />
        </svg>
      )
    case 'crate':
      return (
        <svg {...shared} className="symbol-svg symbol-crate">
          <path className="filled" d="M12 19h40v34H12z" />
          <path d="M12 19 32 9l20 10M12 19l20 12 20-12M32 31v22M18 26l12 8M46 26l-12 8" />
        </svg>
      )
    case 'footprint':
      return (
        <svg {...shared} className="symbol-svg symbol-footprint">
          <ellipse className="filled" cx="27" cy="38" rx="9" ry="14" transform="rotate(-18 27 38)" />
          <ellipse cx="20" cy="18" rx="4" ry="6" />
          <ellipse cx="29" cy="14" rx="4" ry="6" />
          <ellipse cx="38" cy="17" rx="4" ry="6" />
          <ellipse cx="44" cy="25" rx="4" ry="6" />
        </svg>
      )
  }
}

function DiscoveryIllustration({
  id,
  rarity,
}: {
  id: string
  rarity: TileRarity
}) {
  const asset = CONCEPT_DISCOVERY_ASSETS[id]
  if (asset) {
    return (
      <ConceptImage
        src={asset}
        alt={DISCOVERY_PRESENTATION[id]?.displayName ?? id}
        className={`concept-discovery rarity-${rarity}`}
      />
    )
  }

  const shared = {
    viewBox: '0 0 64 64',
    role: 'img',
    'aria-hidden': true,
    focusable: false,
  } as const

  switch (id) {
    case 'fern':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M32 55V13" />
          <path d="M31 47c-10-1-16-6-20-13 9 0 15 4 20 13zM33 39c10-1 16-6 20-13-9 0-15 4-20 13zM31 31c-8-2-13-7-15-14 8 1 13 5 15 14zM33 25c8-2 13-7 15-14-8 1-13 5-15 14z" />
        </svg>
      )
    case 'river':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M11 17c11-7 19 5 30-2 5-3 9-4 13-3M10 33c13-8 20 6 32-1 5-3 9-4 13-2M10 49c12-7 20 5 32-2 4-2 8-3 12-2" />
        </svg>
      )
    case 'amber':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path className="filled" d="M32 7 51 22 45 50 32 58 19 50 13 22z" />
          <path d="M25 29c4-5 9-4 13-1M30 36l7-9M21 22h22" />
        </svg>
      )
    case 'footprints':
      return <SymbolIllustration symbol="footprint" />
    case 'small-fossil':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M16 38c8-11 21-16 35-15" />
          <path d="M25 30c-4-3-7-5-11-5M32 27c-1-5-2-8-5-12M39 25c3-4 7-6 12-7M22 48c4-4 7-7 9-12M37 43c-2-3-4-6-6-10M47 35c-5-1-9-2-13-5" />
        </svg>
      )
    case 'bone-cluster':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M16 22c-4-3-3-9 2-10 3-1 5 1 6 3l16 27c2-2 5-2 8 0 4 3 3 9-2 10-3 1-5-1-6-3L24 22c-2 2-5 2-8 0z" />
          <path d="M48 17c4-3 3-9-2-10-3-1-5 1-6 3L16 46" />
        </svg>
      )
    case 'dinosaur-egg':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path className="filled" d="M32 7c12 13 18 25 18 36 0 10-7 16-18 16s-18-6-18-16c0-11 6-23 18-36z" />
          <path d="M22 35c5 4 10 4 15 0M27 48c4-3 8-3 12 0M31 21l4 6-6 3" />
        </svg>
      )
    case 'nest':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M10 41c12 9 32 9 44 0M14 38c10 5 26 6 36 0M18 34c8 3 20 4 28 0" />
          <path className="filled" d="M27 19c-7 8-9 15-2 18 5 2 11 2 16 0 7-3 5-10-2-18-4-5-8-5-12 0z" />
        </svg>
      )
    case 'complete-skeleton':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M9 39c11-12 25-16 45-12M17 43c13 2 24 1 35-5M24 32l-5-10M32 29l-1-13M40 28l6-11M29 45l-6 9M38 43l6 9" />
          <path className="filled" d="M48 22c5-2 9 1 8 5-1 5-7 7-12 4z" />
        </svg>
      )
    case 'living-specimen':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path className="filled" d="M12 42c11-20 28-26 40-14 2 9-3 17-13 20-11 4-21 2-27-6z" />
          <path d="M43 25c2-6 6-9 11-10M22 43l-7 10M38 48l3 9M44 34h.1" />
        </svg>
      )
    case 'new-species':
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path className="filled" d="M32 6 39 24l19 2-14 12 4 19-16-10-16 10 4-19L6 26l19-2z" />
          <path d="M23 32c6 4 12 4 18 0M28 25h.1M36 25h.1" />
        </svg>
      )
    default:
      return (
        <svg {...shared} className={`discovery-svg rarity-${rarity}`}>
          <path d="M13 18h38v28H13zM20 25h24M20 34h18" />
        </svg>
      )
  }
}

function freshBoard(config: GameConfig): BaseSpinResult {
  return spinBaseGame(config, createSeededRng(1))
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatOdds(value: number): string {
  return value === 0 ? 'Never' : `1 in ${Math.round(1 / value)}`
}

function formatTargetValue(value: number, percent = true): string {
  return percent ? `${(value * 100).toFixed(1)}%` : value.toFixed(1)
}

function formatTargetRange(range: TargetRange, percent = true): string {
  return `${formatTargetValue(range.min, percent)}–${formatTargetValue(range.max, percent)}`
}

function updateTarget(
  targets: TuningTargets,
  key: keyof TuningTargets,
  side: keyof TargetRange,
  value: number,
  percent = true,
): TuningTargets {
  return {
    ...targets,
    [key]: {
      ...targets[key],
      [side]: percent ? value / 100 : value,
    },
  }
}

function updateConfigNumber(
  config: GameConfig,
  updater: (draft: GameConfig) => void,
): GameConfig {
  const draft = JSON.parse(JSON.stringify(config)) as GameConfig
  updater(draft)
  return draft
}

interface SpinLedgerEntry {
  id: number
  bet: number
  baseWin: number
  evidenceBonus: number
  featureWin: number | null
  totalWin: number
  net: number
  balanceAfter: number
  featureTriggered: boolean
  footprintCount: number
  status: 'base-only' | 'feature-active' | 'complete'
}

type PresentationBeat =
  | 'idle'
  | 'reeling'
  | 'cluster'
  | 'wild'
  | 'golden'
  | 'evidence'
  | 'footprint'
  | 'transition'

type WinTier = 'dead' | 'tiny' | 'small' | 'medium' | 'large'

interface FeatureRevealEvent {
  index: number
  tileId: string
  displayName: string
  payoutValue: number
  rarity: TileRarity
  respinsRemaining: number
  totalFeatureValue: number
  order: number
}

function toFeatureRevealEvents(
  reveals: FeatureReveal[],
  session: FeatureSession,
): FeatureRevealEvent[] {
  return reveals.map((reveal, order) => {
    const presentation = discoveryPresentation(reveal.tile)
    return {
      index: reveal.index,
      tileId: reveal.tile.id,
      displayName: presentation.displayName,
      payoutValue: reveal.tile.payoutValue,
      rarity: presentation.rarity,
      respinsRemaining: session.respinsRemaining,
      totalFeatureValue: session.totalWin,
      order,
    }
  })
}

const REEL_SPIN_SYMBOLS: SymbolId[] = [
  'trexTooth',
  'raptorClaw',
  'scientist',
  'crate',
  'footprint',
  'helicopter',
  'goldenAmber',
  'jeep',
  'campWild',
  'map',
]

function formatCredits(value: number): string {
  return value.toFixed(2)
}

function baseWinTier(win: number): WinTier {
  if (win <= 0) return 'dead'
  if (win < 1) return 'tiny'
  if (win < 5) return 'small'
  if (win < 20) return 'medium'
  return 'large'
}

function promoteWinTier(tier: WinTier): WinTier {
  if (tier === 'dead') return 'tiny'
  if (tier === 'tiny') return 'small'
  if (tier === 'small') return 'medium'
  return 'large'
}

function outcomeWinTier(win: number, goldenAmberPaying: boolean): WinTier {
  const tier = baseWinTier(win)
  return goldenAmberPaying ? promoteWinTier(tier) : tier
}

function presentationDurationForTier(tier: WinTier, compressed: boolean): number {
  if (compressed) return tier === 'dead' ? 40 : 90
  switch (tier) {
    case 'dead':
      return 180
    case 'tiny':
      return 140
    case 'small':
      return 320
    case 'medium':
      return 680
    case 'large':
      return 1050
  }
}

function balanceCountDurationForTier(tier: WinTier): number {
  switch (tier) {
    case 'large':
      return 900
    case 'medium':
      return 620
    case 'small':
      return 320
    case 'tiny':
      return 160
    case 'dead':
      return 180
  }
}

function baseGameMessage(
  spin: BaseSpinResult,
  lastFeatureWin: number | null,
  winTier: WinTier,
): string {
  if (lastFeatureWin !== null) {
    return `Fossil Valley survey complete · ${lastFeatureWin.toFixed(2)} credits recovered`
  }
  if (spin.featureTriggered) return 'Three Footprints — the hidden valley opens.'
  if (spin.fieldNotes.bonus > 0) {
    return `FIELD NOTES UPDATED · Discovery Bonus ${spin.fieldNotes.bonus.toFixed(2)} · Total ${spin.baseWin.toFixed(2)}`
  }
  if (spin.footprintCount === 2) return 'Two trail markers found — one more would reveal the route.'
  if (spin.clusterWin > 0) {
    if (winTier === 'tiny') return `Minor find · ${spin.clusterWin.toFixed(2)} credits`
    if (winTier === 'small') return `${spin.clusterWins.length} expedition cluster${spin.clusterWins.length === 1 ? '' : 's'} pay ${spin.clusterWin.toFixed(2)}`
    if (winTier === 'medium') return `Notable discovery · ${spin.clusterWin.toFixed(2)} credits`
    return `Major expedition find · ${spin.clusterWin.toFixed(2)} credits`
  }
  if (spin.fieldNotes.uniqueEvidence.length > 0) return 'Evidence logged. No payout this time.'
  if (spin.footprintCount === 1) return 'A faint trail mark fades into the brush.'
  return 'No fresh signs in this sector.'
}

function App() {
  const manualRng = useRef(createSeededRng(20260708))
  const nextSpinId = useRef(1)
  const nextFeatureSessionId = useRef(1)
  const spinTimers = useRef<number[]>([])
  const [config, setConfig] = useState<GameConfig>(() =>
    JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
  )
  const [spin, setSpin] = useState<BaseSpinResult>(() => freshBoard(DEFAULT_CONFIG))
  const [feature, setFeature] = useState<FeatureSession | null>(null)
  const [featureIntro, setFeatureIntro] = useState(false)
  const [featureEnding, setFeatureEnding] = useState(false)
  const [featureRevealEvents, setFeatureRevealEvents] = useState<FeatureRevealEvent[]>([])
  const [lastFeatureWin, setLastFeatureWin] = useState<number | null>(null)
  const [startingBalance, setStartingBalance] = useState(100)
  const [bet, setBet] = useState(1)
  const [balance, setBalance] = useState(100)
  const [displayedBalance, setDisplayedBalance] = useState(100)
  const [currentWinTier, setCurrentWinTier] = useState<WinTier>('dead')
  const [lastSpinSummary, setLastSpinSummary] = useState<SpinLedgerEntry | null>(null)
  const [spinHistory, setSpinHistory] = useState<SpinLedgerEntry[]>([])
  const [activeLedgerId, setActiveLedgerId] = useState<number | null>(null)
  const [isReeling, setIsReeling] = useState(false)
  const [settledReels, setSettledReels] = useState(5)
  const [winAnimationKey, setWinAnimationKey] = useState(0)
  const [triggerTransition, setTriggerTransition] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [presentationBeat, setPresentationBeat] = useState<PresentationBeat>('idle')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [skipAnimations, setSkipAnimations] = useState(false)
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isTuning, setIsTuning] = useState(false)
  const [targets, setTargets] = useState<TuningTargets>(() =>
    JSON.parse(JSON.stringify(DEFAULT_TUNING_TARGETS)),
  )
  const [sweepResults, setSweepResults] = useState<TuningSweepResult[]>([])
  const [configNotice, setConfigNotice] = useState<string | null>(null)

  useEffect(() => {
    for (const src of [
      ...Object.values(CONCEPT_SYMBOL_ASSETS),
      ...Object.values(CONCEPT_DISCOVERY_ASSETS),
    ]) {
      const image = new Image()
      image.src = src
      void image.decode?.().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reducedMotion || skipAnimations) {
      setDisplayedBalance(balance)
      return
    }

    const start = displayedBalance
    const delta = balance - start
    if (Math.abs(delta) < 0.005) {
      setDisplayedBalance(balance)
      return
    }

    const duration = balanceCountDurationForTier(currentWinTier)
    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayedBalance(start + delta * eased)
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick)
      } else {
        setDisplayedBalance(balance)
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [balance, currentWinTier, reducedMotion, skipAnimations])

  const resetCredits = () => {
    spinTimers.current.forEach((timer) => window.clearTimeout(timer))
    spinTimers.current = []
    setBalance(startingBalance)
    setDisplayedBalance(startingBalance)
    setCurrentWinTier('dead')
    setSpinHistory([])
    setLastSpinSummary(null)
    setLastFeatureWin(null)
    setActiveLedgerId(null)
    setFeature(null)
    setFeatureIntro(false)
    setFeatureEnding(false)
    setFeatureRevealEvents([])
    setIsReeling(false)
    setIsCelebrating(false)
    setPresentationBeat('idle')
    setSettledReels(5)
    setTriggerTransition(false)
    nextSpinId.current = 1
    nextFeatureSessionId.current = 1
  }

  const handleSpin = () => {
    if (feature || balance < bet || isReeling || triggerTransition || isCelebrating) return
    spinTimers.current.forEach((timer) => window.clearTimeout(timer))
    spinTimers.current = []
    const result = spinBaseGame(config, manualRng.current)
    const id = nextSpinId.current
    nextSpinId.current += 1
    const balanceAfterBase = balance - bet + result.baseWin
    const hasGoldenAmber = result.clusterWins.some(
      (cluster) => cluster.symbol === 'goldenAmber',
    )
    const winTier = outcomeWinTier(result.baseWin, hasGoldenAmber)
    const entry: SpinLedgerEntry = {
      id,
      bet,
      baseWin: result.baseWin,
      evidenceBonus: result.fieldNotes.bonus,
      featureWin: result.featureTriggered ? null : 0,
      totalWin: result.baseWin,
      net: result.baseWin - bet,
      balanceAfter: balanceAfterBase,
      featureTriggered: result.featureTriggered,
      footprintCount: result.footprintCount,
      status: result.featureTriggered ? 'feature-active' : 'base-only',
    }

    setLastFeatureWin(null)
    setFeatureRevealEvents([])
    setCurrentWinTier(winTier)
    setSpin(result)
    setIsReeling(true)
    setIsCelebrating(true)
    setPresentationBeat('reeling')
    setSettledReels(0)
    setTriggerTransition(false)

    const compressed = reducedMotion || skipAnimations
    const reelStart = compressed ? 60 : 420
    const reelDelay = compressed ? 0 : 75
    const reelSettle = compressed ? 80 : 250
    const footprintAnticipationDelay = compressed
      ? 0
      : result.featureTriggered
        ? 760
        : 520

    let visibleFootprintsAfterStop = 0
    let anticipationHold = 0
    let anticipationApplied = false
    const reelStopTimes = Array.from({ length: config.boardSize }, (_, reelIndex) => {
      const stopTime = reelStart + reelIndex * reelDelay + anticipationHold
      const footprintsOnStoppingReel = result.board.reduce(
        (count, row) => count + (row[reelIndex] === 'footprint' ? 1 : 0),
        0,
      )

      visibleFootprintsAfterStop += footprintsOnStoppingReel
      const reelsStillHidden = reelIndex < config.boardSize - 1
      if (
        !anticipationApplied &&
        reelsStillHidden &&
        visibleFootprintsAfterStop >= 2 &&
        result.footprintCount >= 2
      ) {
        anticipationHold += footprintAnticipationDelay
        anticipationApplied = true
      }

      return stopTime
    })

    reelStopTimes.forEach((stopTime, reelIndex) => {
      const timer = window.setTimeout(() => {
        setSettledReels(reelIndex + 1)
      }, stopTime)
      spinTimers.current.push(timer)
      return timer
    })

    // Presentation state machine:
    // 1) engine resolves immediately above
    // 2) the true board is placed under a full reel-motion mask before paint
    // 3) readable outcomes stay gated until the reels visually stop
    // 4) each result category gets its own short readable beat
    // 5) UI unlocks only after the final beat or feature transition completes
    const finishTimer = window.setTimeout(() => {
      setIsReeling(false)
      setSettledReels(config.boardSize)
      setBalance(balanceAfterBase)
      setLastSpinSummary(entry)
      setSpinHistory((history) => [entry, ...history].slice(0, 25))
      setWinAnimationKey((key) => key + 1)

      const hasWildAssist = result.clusterWins.some((cluster) => cluster.wildAssisted)
      const beats: Array<{ beat: PresentationBeat; duration: number }> = []
      if (result.clusterWins.length > 0) {
        beats.push({ beat: 'cluster', duration: presentationDurationForTier(winTier, compressed) })
      } else if (!compressed) {
        beats.push({ beat: 'cluster', duration: presentationDurationForTier('dead', compressed) })
      }
      if (hasWildAssist) beats.push({ beat: 'wild', duration: compressed ? 80 : winTier === 'large' ? 720 : 460 })
      if (hasGoldenAmber) beats.push({ beat: 'golden', duration: compressed ? 90 : winTier === 'large' ? 980 : 680 })
      if (result.fieldNotes.uniqueEvidence.length > 0) {
        beats.push({
          beat: 'evidence',
          duration: compressed ? 90 : result.fieldNotes.bonus > 0 ? 620 : 360,
        })
      }
      if (result.footprintCount > 0) {
        beats.push({
          beat: 'footprint',
          duration: compressed ? 90 : result.featureTriggered ? 820 : result.footprintCount === 2 ? 520 : 260,
        })
      }

      let elapsed = 0
      for (const { beat, duration } of beats) {
        const beatTimer = window.setTimeout(() => setPresentationBeat(beat), elapsed)
        spinTimers.current.push(beatTimer)
        elapsed += duration
      }

      const endPresentationTimer = window.setTimeout(() => {
        if (result.featureTriggered) {
          setPresentationBeat('transition')
          setTriggerTransition(true)
          const featureTimer = window.setTimeout(() => {
          const featureRngSeed = manualRng.current.int(1, 0x7fffffff)
          const featureSessionId = nextFeatureSessionId.current
          nextFeatureSessionId.current += 1
          setFeature(
            createFeatureSession(
              config.featureProfile,
              createSeededRng(featureRngSeed),
              result.featureStartingRespins,
              {
                sessionId: featureSessionId,
                featureRngSeed,
                boardGenerationSeed: featureRngSeed,
              },
            ),
          )
          setFeatureRevealEvents([])
          setFeatureIntro(true)
          setTriggerTransition(false)
          setIsCelebrating(false)
          setPresentationBeat('idle')
          const introTimer = window.setTimeout(() => setFeatureIntro(false), 950)
          spinTimers.current.push(introTimer)
          }, compressed ? 160 : 2200)
          spinTimers.current.push(featureTimer)
        } else {
          setPresentationBeat('idle')
          setIsCelebrating(false)
        }
      }, elapsed)
      spinTimers.current.push(endPresentationTimer)
    }, reelStopTimes[reelStopTimes.length - 1] + reelSettle)
    spinTimers.current.push(finishTimer)

    if (result.featureTriggered) {
      setActiveLedgerId(id)
    } else {
      setActiveLedgerId(null)
    }
  }

  const handleSimulation = (spins: number, seed: number) => {
    setIsSimulating(true)
    window.setTimeout(() => {
      setSimulation(runSimulation(config, spins, seed))
      setIsSimulating(false)
    }, 20)
  }

  const handleTuningSweep = (spins: number, seed: number) => {
    setIsTuning(true)
    window.setTimeout(() => {
      setSweepResults(runTuningSweep(config, targets, Math.min(spins, 10_000), seed))
      setIsTuning(false)
    }, 20)
  }

  const exportConfig = () => {
    const blob = new Blob([serializeConfig(config)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'lost-valley-config.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setConfigNotice('Config exported.')
  }

  const importConfig = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseConfig(await file.text())
      setConfig(imported)
      setSpin(freshBoard(imported))
      setFeature(null)
      setFeatureRevealEvents([])
      setFeatureIntro(false)
      setFeatureEnding(false)
      setSimulation(null)
      setActiveLedgerId(null)
      manualRng.current = createSeededRng(20260708)
      nextFeatureSessionId.current = 1
      setConfigNotice(`Loaded ${file.name}.`)
    } catch (error) {
      setConfigNotice(error instanceof Error ? error.message : 'Config import failed.')
    }
  }

  const leaveFeature = () => {
    const featureWin = feature?.totalWin ?? 0
    setFeatureEnding(true)
    window.setTimeout(() => {
      setCurrentWinTier(baseWinTier(featureWin))
      setLastFeatureWin(featureWin)
      setBalance((current) => current + featureWin)
      setLastSpinSummary((entry) =>
        entry && activeLedgerId === entry.id
          ? {
              ...entry,
              featureWin,
              totalWin: entry.baseWin + featureWin,
              net: entry.baseWin + featureWin - entry.bet,
              balanceAfter: entry.balanceAfter + featureWin,
              status: 'complete',
            }
          : entry,
      )
      setSpinHistory((history) =>
        history.map((entry) =>
          activeLedgerId === entry.id
            ? {
                ...entry,
                featureWin,
                totalWin: entry.baseWin + featureWin,
                net: entry.baseWin + featureWin - entry.bet,
                balanceAfter: entry.balanceAfter + featureWin,
                status: 'complete',
              }
            : entry,
        ),
      )
      setActiveLedgerId(null)
      setFeature(null)
      setFeatureIntro(false)
      setFeatureEnding(false)
      setFeatureRevealEvents([])
    }, 900)
  }

  const stepFeature = () => {
    if (featureIntro || featureEnding || !feature) return
    const next = stepFeatureSession(feature)
    const latestReveals = next.steps.at(-1)?.reveals ?? []
    setFeature(next)
    setFeatureRevealEvents(toFeatureRevealEvents(latestReveals, next))
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="eyebrow">Expedition File 07</div>
        <h1>Lost Valley</h1>
        <p>The evidence points somewhere no map remembers.</p>
      </header>

      <div className="workbench">
        <section className="cabinet" aria-label="Lost Valley slot cabinet">
          <div className="cabinet-top">
            <span>Base Camp</span>
            <span className={`cabinet-balance win-tier-${currentWinTier}`}>
              Balance {formatCredits(displayedBalance)}
            </span>
            <span className="status-light">● Survey active</span>
          </div>

          <div
            className={`screen ${triggerTransition ? 'trigger-transition' : ''} ${
              featureEnding ? 'feature-fadeout' : ''
            }`}
          >
            {feature ? (
              <FeatureBoard
                session={feature}
                onStep={stepFeature}
                onLeave={leaveFeature}
                introActive={featureIntro}
                endingActive={featureEnding}
                revealEvents={featureRevealEvents}
              />
            ) : (
              <BaseGame
                spin={spin}
                lastFeatureWin={lastFeatureWin}
                isReeling={isReeling}
                settledReels={settledReels}
                winAnimationKey={winAnimationKey}
                triggerTransition={triggerTransition}
                presentationBeat={presentationBeat}
                winTier={currentWinTier}
                reducedMotion={reducedMotion || skipAnimations}
              />
            )}
          </div>

          {!feature && (
            <div className="controls">
              <div>
                <small>BALANCE</small>
                <strong>{formatCredits(displayedBalance)}</strong>
              </div>
              <div>
                <small>BET</small>
                <strong>{formatCredits(bet)}</strong>
              </div>
              <div>
                <small>BASE WIN</small>
                <strong>{formatCredits(spin.baseWin)}</strong>
              </div>
              <button
                className="spin-button"
                onClick={handleSpin}
                disabled={balance < bet || isReeling || triggerTransition || isCelebrating}
              >
                {isReeling ? 'ROLL' : balance >= bet ? 'SPIN' : 'EMPTY'}
                <span>
                  {triggerTransition
                    ? 'Valley opens'
                    : isReeling
                      ? 'Reels turning'
                      : balance >= bet
                        ? 'Begin survey'
                        : 'Reset credits'}
                </span>
              </button>
              <label className="motion-toggle">
                <input
                  type="checkbox"
                  checked={skipAnimations}
                  onChange={(event) => setSkipAnimations(event.target.checked)}
                />
                Skip anim
              </label>
            </div>
          )}
        </section>

        <div className="side-rail">
          <CreditPanel
            balance={balance}
            displayedBalance={displayedBalance}
            startingBalance={startingBalance}
            bet={bet}
            lastSpin={lastSpinSummary}
            history={spinHistory}
            onStartingBalanceChange={setStartingBalance}
            onBetChange={setBet}
            onReset={resetCredits}
          />

          <SimulationPanel
            result={simulation}
            isRunning={isSimulating}
            onRun={handleSimulation}
            onExport={exportConfig}
            onImport={importConfig}
            configNotice={configNotice}
            config={config}
            onConfigChange={setConfig}
            targets={targets}
            onTargetsChange={setTargets}
            onRunSweep={handleTuningSweep}
            isTuning={isTuning}
            sweepResults={sweepResults}
            onApplySweepConfig={(nextConfig) => {
              setConfig(nextConfig)
              setSpin(freshBoard(nextConfig))
              setFeature(null)
              setFeatureRevealEvents([])
              setActiveLedgerId(null)
              setSimulation(null)
              setConfigNotice('Applied tuning sweep configuration.')
            }}
          />
        </div>
      </div>

      {simulation && <Diagnostics result={simulation} targets={targets} />}

      <footer>
        Prototype math only · Seeded engine · 1 credit per spin · Orthogonal clusters pay
      </footer>
    </main>
  )
}

function BaseGame({
  spin,
  lastFeatureWin,
  isReeling,
  settledReels,
  winAnimationKey,
  triggerTransition,
  presentationBeat,
  winTier,
  reducedMotion,
}: {
  spin: BaseSpinResult
  lastFeatureWin: number | null
  isReeling: boolean
  settledReels: number
  winAnimationKey: number
  triggerTransition: boolean
  presentationBeat: PresentationBeat
  winTier: WinTier
  reducedMotion: boolean
}) {
  const revealEvidence = presentationBeat === 'evidence' || presentationBeat === 'footprint' || presentationBeat === 'transition' || presentationBeat === 'idle'
  const revealFootprints = presentationBeat === 'footprint' || presentationBeat === 'transition' || presentationBeat === 'idle'
  const twoFootprintSweat = presentationBeat === 'footprint' && spin.footprintCount === 2
  return (
    <div
      className={`base-game beat-${presentationBeat} win-tier-${winTier} ${
        twoFootprintSweat ? 'two-footprint-sweat' : ''
      } ${isReeling ? 'reels-active' : ''} ${
        reducedMotion ? 'reduced-motion' : ''
      }`}
    >
      <div className="base-game-layout">
        <LostValleyPanel
          footprintCount={revealFootprints ? spin.footprintCount : 0}
          featureTriggered={revealFootprints && spin.featureTriggered}
          active={presentationBeat === 'footprint' || presentationBeat === 'transition'}
          suspense={twoFootprintSweat}
        />
        <div className="reel-stage">
      <div className="game-label">
        <span>Expedition grid</span>
        <span>{spin.footprintCount}/3 trail markers</span>
      </div>
      <div className="symbol-grid">
        {spin.board.flatMap((row, rowIndex) =>
          row.map((symbol, columnIndex) => {
            const display = SYMBOL_DISPLAY[symbol]
            const spinning = isReeling && columnIndex >= settledReels
                const winning = spin.clusterWins.some(
                  (win) =>
                    win.cells.some(
                      (cell) => cell.row === rowIndex && cell.column === columnIndex,
                    ),
                )
                const wildAssistedPaying = spin.clusterWins.some(
                  (win) =>
                    win.wildAssisted &&
                    win.cells.some(
                      (cell) => cell.row === rowIndex && cell.column === columnIndex,
                    ),
                )
                const goldenAmberPaying = spin.clusterWins.some(
                  (win) =>
                    win.symbol === 'goldenAmber' &&
                    win.cells.some(
                      (cell) => cell.row === rowIndex && cell.column === columnIndex,
                    ),
                )
                return (
                  <div
                    className={`symbol reel-${columnIndex} ${
                      symbol === 'footprint' ? 'scatter' : ''
                    } ${symbol === 'campWild' ? 'wild' : ''} ${
                      symbol === 'goldenAmber' ? 'golden-amber' : ''
                    } ${
                      FIELD_NOTE_SYMBOLS.includes(symbol as (typeof FIELD_NOTE_SYMBOLS)[number])
                        ? 'evidence'
                        : ''
                    } ${
                      wildAssistedPaying &&
                      !isReeling &&
                      (presentationBeat === 'wild' || presentationBeat === 'idle')
                        ? 'wild-assisted'
                        : ''
                    } ${
                      goldenAmberPaying &&
                      !isReeling &&
                      (presentationBeat === 'golden' || presentationBeat === 'idle')
                        ? 'golden-paying'
                        : ''
                    } ${
                      winning &&
                      !isReeling &&
                      (presentationBeat === 'cluster' || presentationBeat === 'idle')
                        ? 'winning'
                        : ''
                    } ${
                  spinning ? 'reel-spinning' : ''
                } ${isReeling && columnIndex < settledReels ? 'reel-settled' : ''} ${
                  (triggerTransition || (presentationBeat === 'footprint' && spin.footprintCount >= 2)) && symbol === 'footprint' ? 'trigger-footprint' : ''
                }`}
                data-win-key={winning ? winAnimationKey : undefined}
                key={`${rowIndex}-${columnIndex}`}
                style={
                  triggerTransition && symbol === 'footprint'
                    ? { animationDelay: `${Math.min(rowIndex + columnIndex, 5) * 110}ms` }
                    : undefined
                }
                title={display.label}
              >
                {spinning ? (
                  <ReelMotionStrip columnIndex={columnIndex} />
                ) : (
                  <>
                    <span className="symbol-art">
                      <SymbolIllustration symbol={symbol} />
                    </span>
                    <small>{display.label}</small>
                  </>
                )}
                {winning && !isReeling && (
                  <span className="dust-burst" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
            )
          }),
        )}
      </div>
      <div className="message-strip">
        {isReeling ? 'Expedition reels in motion…' : baseGameMessage(spin, lastFeatureWin, winTier)}
      </div>
      <details className="cluster-debug">
        <summary className="debug-heading">
          <span>Last-spin cluster scan</span>
          <strong>{spin.clusterWins.length} paying</strong>
        </summary>
        {spin.clusterWins.length > 0 ? (
          <ul>
            {spin.clusterWins.map((cluster, index) => (
              <li key={`${cluster.symbol}-${index}`}>
                <span>{SYMBOL_DISPLAY[cluster.symbol].label}</span>
                <code>
                  {cluster.size} cells{cluster.wildAssisted ? ' · wild' : ''}
                </code>
                <strong>{cluster.payout.toFixed(2)}x</strong>
              </li>
            ))}
          </ul>
        ) : (
          <small>No orthogonal groups of 4+ detected.</small>
        )}
      </details>
        </div>
        <div className="base-field-notes">
          <FieldNotesPanel spin={spin} reveal={revealEvidence} active={presentationBeat === 'evidence'} />
        </div>
      </div>
    </div>
  )
}

function LostValleyPanel({
  footprintCount,
  featureTriggered,
  active,
  suspense,
}: {
  footprintCount: number
  featureTriggered: boolean
  active: boolean
  suspense: boolean
}) {
  const found = Math.min(footprintCount, 3)
  return (
    <aside
      className={`lost-valley-panel ${featureTriggered ? 'trail-complete' : ''} ${
        active ? 'trail-active' : ''
      } ${suspense ? 'trail-suspense' : ''}`}
    >
      <div className="lost-valley-heading">
        <span>Trail markers</span>
        <strong>{found}/3</strong>
      </div>
      <p>Follow Footprints to the Lost Valley.</p>
      <div className="footprint-track" aria-label={`${found} of 3 Footprints found`}>
        {[0, 1, 2].map((index) => (
          <span
            className={index < found ? 'found' : ''}
            key={index}
            aria-hidden="true"
            style={index < found ? { animationDelay: `${index * 120}ms` } : undefined}
          >
            <SymbolIllustration symbol="footprint" />
          </span>
        ))}
      </div>
      <div className="lost-valley-card" aria-hidden="true" />
    </aside>
  )
}

function ReelMotionStrip({ columnIndex }: { columnIndex: number }) {
  const symbols = Array.from(
    { length: 12 },
    (_, index) => REEL_SPIN_SYMBOLS[(index + columnIndex * 3) % REEL_SPIN_SYMBOLS.length],
  )

  return (
    <span className="reel-motion-strip" aria-hidden="true">
      {symbols.map((symbol, index) => (
        <span className="reel-motion-symbol" key={`${symbol}-${index}`}>
          <SymbolIllustration symbol={symbol} />
        </span>
      ))}
    </span>
  )
}

function FieldNotesPanel({
  spin,
  reveal = true,
  active = false,
}: {
  spin: BaseSpinResult
  reveal?: boolean
  active?: boolean
}) {
  const found = new Set(reveal ? spin.fieldNotes.uniqueEvidence : [])
  return (
    <aside
      className={`field-notes ${reveal && spin.fieldNotes.bonus > 0 ? 'bonus-hit' : ''} ${
        active ? 'notes-active' : ''
      }`}
      key={spin.board.flat().join('-')}
    >
      <div className="field-notes-heading">
        <span className="eyebrow">Field Notes</span>
        <strong>{reveal ? spin.fieldNotes.uniqueEvidence.length : 0}/5</strong>
      </div>
      <p>Document unique evidence found anywhere on the expedition grid.</p>
      <ol>
        {FIELD_NOTE_SYMBOLS.map((symbol, index) => {
          const isFound = found.has(symbol)
          return (
            <li
              className={isFound ? 'found' : ''}
              key={symbol}
              style={isFound ? { animationDelay: `${index * 90}ms` } : undefined}
            >
              <span className="note-check">{isFound ? '✓' : ''}</span>
              <span className="note-art">
                <SymbolIllustration symbol={symbol} />
              </span>
              <strong>{SYMBOL_DISPLAY[symbol].label}</strong>
            </li>
          )
        })}
      </ol>
      <div className="field-notes-bonus">
        {reveal && spin.fieldNotes.bonus > 0 ? (
          <>
            <span>FIELD NOTES UPDATED</span>
            <strong>{spin.fieldNotes.bonus.toFixed(2)}x</strong>
          </>
        ) : (
          <>
            <span>Discovery Bonus</span>
            <strong>3+ unique</strong>
          </>
        )}
      </div>
    </aside>
  )
}

function FeatureBoard({
  session,
  onStep,
  onLeave,
  introActive,
  endingActive,
  revealEvents,
}: {
  session: FeatureSession
  onStep: () => void
  onLeave: () => void
  introActive: boolean
  endingActive: boolean
  revealEvents: FeatureRevealEvent[]
}) {
  const discoveries = session.steps.flatMap((step) => step.reveals)
  const lastStep = session.steps.at(-1)
  const collectorEvent = lastStep?.reveals.some((reveal) => reveal.tile.kind === 'collector')
  const revealEventByIndex = new Map(revealEvents.map((event) => [event.index, event]))

  return (
    <div
      className={`feature-screen ${introActive ? 'feature-intro-active' : ''} ${
        collectorEvent ? 'collector-event' : ''
      } ${lastStep && !lastStep.hit && !session.isComplete ? 'feature-miss' : ''} ${
        session.isComplete ? 'feature-complete' : ''
      }`}
    >
      {introActive && (
        <div className="feature-intro">
          <span className="eyebrow">Valley discovered</span>
          <h2>{session.profile.displayName}</h2>
          <p>Steady discoveries. Reliable rewards.</p>
        </div>
      )}
      <div className="feature-heading">
        <div>
          <span className="eyebrow">Destination discovered</span>
          <h2>{session.profile.displayName}</h2>
        </div>
      </div>
      <p className="feature-copy">
        {session.isComplete ? 'Survey complete.' : 'The expedition awaits your survey.'}{' '}
        {discoveries.length} of {session.tiles.length} sites revealed ·{' '}
        {session.respinsRemaining} respins remain.
      </p>
      <div className="feature-exploration">
        <div
          className="fog-grid discovery-grid"
          style={{ gridTemplateColumns: `repeat(${session.profile.boardWidth}, 1fr)` }}
        >
          {session.tiles.map((tile, index) => {
            const presentation = tile ? discoveryPresentation(tile) : null
            const revealEvent = revealEventByIndex.get(index)
            return (
              <div
                className={
                  tile === null
                    ? 'fog-tile'
                    : `fog-tile discovery-card kind-${tile.kind} rarity-${presentation!.rarity} discovery-${tile.id} ${
                        revealEvent !== undefined ? 'newly-revealed' : ''
                      }`
                }
                key={index}
                style={
                  revealEvent !== undefined
                    ? { animationDelay: `${revealEvent.order * 120}ms` }
                    : undefined
                }
                title={presentation?.displayName}
              >
                {tile === null ? (
                  <span className="fog-mark">≈</span>
                ) : (
                  <>
                    <span className="discovery-icon">
                      <DiscoveryIllustration
                        id={tile.id}
                        rarity={presentation!.rarity}
                      />
                    </span>
                    <strong>{presentation!.displayName}</strong>
                    {revealEvent && (
                      <span
                        className="reveal-fog-overlay"
                        style={{ animationDelay: `${revealEvent.order * 120}ms` }}
                        aria-hidden="true"
                      />
                    )}
                    <small>{presentation!.rarity} · {tile.payoutValue.toFixed(0)}x</small>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <aside className="feature-sidebar">
          <div className="feature-side-stat feature-total">
            <small>Discovery value</small>
            <strong>{session.totalWin.toFixed(2)}</strong>
          </div>
          <div className="feature-side-stat">
            <small>Respins</small>
            <strong>{session.respinsRemaining}</strong>
          </div>
          {import.meta.env.DEV && (
            <FeatureDebugPanel
              session={session}
              currentState={
                endingActive
                  ? 'ending'
                  : introActive
                    ? 'intro'
                    : session.isComplete
                      ? 'complete'
                      : lastStep?.hit
                        ? 'revealed'
                        : lastStep
                          ? 'miss'
                          : 'ready'
              }
            />
          )}
          <div className="feature-side-stat">
            <small>Revealed</small>
            <strong>
              {discoveries.length}/{session.tiles.length}
            </strong>
          </div>
          <div className="discovery-log">
          <div className="discovery-log-heading">
            <span>Field log</span>
            <strong>{discoveries.length}</strong>
          </div>
          {discoveries.length === 0 ? (
            <p>Scanning through the fog…</p>
          ) : (
            <ol>
              {discoveries.map((reveal, index) => {
                const presentation = discoveryPresentation(reveal.tile)
                return (
                  <li className={`rarity-${presentation.rarity}`} key={`${index}-${reveal.index}`}>
                    <span className="log-icon">
                      <DiscoveryIllustration
                        id={reveal.tile.id}
                        rarity={presentation.rarity}
                      />
                    </span>
                    <div>
                      <strong>{presentation.displayName}</strong>
                      <small>{presentation.rarity}</small>
                    </div>
                    <b>{reveal.tile.payoutValue.toFixed(0)}x</b>
                  </li>
                )
              })}
            </ol>
          )}
          </div>
        </aside>
      </div>
      <div className="feature-footer">
        <span>
          {session.isComplete
            ? session.fullyRevealed
              ? 'The entire valley is revealed'
              : 'Survey exhausted'
            : lastStep?.hit
              ? 'Evidence detected'
              : lastStep
                ? 'No discovery — one respin spent'
                : '25 hidden sites await'}
        </span>
        {session.isComplete ? (
          <button onClick={onLeave} disabled={endingActive}>
            {endingActive ? 'Counting survey…' : 'Return to base camp'}
          </button>
        ) : (
          <button
            className="survey-button"
            onClick={onStep}
            disabled={introActive || endingActive}
          >
            {introActive
              ? 'Entering valley…'
              : session.steps.length === 0
                ? 'Survey valley'
                : 'Respin'}
          </button>
        )}
      </div>
    </div>
  )
}

function FeatureDebugPanel({
  session,
  currentState,
}: {
  session: FeatureSession
  currentState: string
}) {
  const revealCount = session.tiles.filter((tile) => tile !== null).length
  const hiddenCount = session.tiles.length - revealCount

  return (
    <details className="feature-debug-panel">
      <summary>Feature debug</summary>
      <dl>
        <div>
          <dt>Feature Session ID</dt>
          <dd>{session.debug?.sessionId ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Feature RNG seed</dt>
          <dd>{session.debug?.featureRngSeed ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Board generation seed</dt>
          <dd>{session.debug?.boardGenerationSeed ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Reveal count</dt>
          <dd>{revealCount}</dd>
        </div>
        <div>
          <dt>Remaining hidden tiles</dt>
          <dd>{hiddenCount}</dd>
        </div>
        <div>
          <dt>Current respins</dt>
          <dd>{session.respinsRemaining}</dd>
        </div>
        <div>
          <dt>Current feature state</dt>
          <dd>{currentState}</dd>
        </div>
      </dl>
    </details>
  )
}

function CreditPanel({
  balance,
  displayedBalance,
  startingBalance,
  bet,
  lastSpin,
  history,
  onStartingBalanceChange,
  onBetChange,
  onReset,
}: {
  balance: number
  displayedBalance: number
  startingBalance: number
  bet: number
  lastSpin: SpinLedgerEntry | null
  history: SpinLedgerEntry[]
  onStartingBalanceChange: (value: number) => void
  onBetChange: (value: number) => void
  onReset: () => void
}) {
  return (
    <aside className="credit-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Expedition bank</span>
          <h2>Credits</h2>
        </div>
        <span className={`balance-readout ${balance < bet ? 'low' : ''}`}>
          {formatCredits(displayedBalance)}
        </span>
      </div>

      <div className="credit-controls">
        <NumberControl
          label="Starting balance"
          value={startingBalance}
          min={0}
          step={1}
          onChange={onStartingBalanceChange}
        />
        <NumberControl
          label="Bet"
          value={bet}
          min={0.01}
          step={0.01}
          onChange={(value) => onBetChange(Math.max(0.01, value))}
        />
        <button onClick={onReset}>Reset session</button>
      </div>

      <div className="last-spin-card">
        <h3>Last spin</h3>
        {lastSpin ? (
          <div className="last-spin-grid">
            <CreditStat label="Spin cost" value={-lastSpin.bet} signed />
            <CreditStat label="Base win" value={lastSpin.baseWin} />
            <CreditStat label="Evidence bonus" value={lastSpin.evidenceBonus} />
            <CreditStat
              label="Feature win"
              value={lastSpin.featureWin}
              pending={lastSpin.featureTriggered && lastSpin.featureWin === null}
            />
            <CreditStat label="Total win" value={lastSpin.totalWin} />
            <CreditStat label="Net result" value={lastSpin.net} signed />
            <CreditStat label="Balance after" value={lastSpin.balanceAfter} />
          </div>
        ) : (
          <p>No paid spins yet.</p>
        )}
      </div>

      <div className="spin-history">
        <div className="spin-history-heading">
          <span>Recent spins</span>
          <strong>{history.length}/25</strong>
        </div>
        {history.length === 0 ? (
          <p>Spin history will appear here.</p>
        ) : (
          <ol>
            {history.map((entry) => (
              <li className={entry.net >= 0 ? 'positive' : 'negative'} key={entry.id}>
                <span>#{entry.id}</span>
                <div>
                  <strong>
                    {entry.featureTriggered
                      ? entry.status === 'feature-active'
                        ? 'Feature surveying'
                        : 'Feature complete'
                      : 'Base spin'}
                  </strong>
                  <small>
                    Bet {formatCredits(entry.bet)} · Base {formatCredits(entry.baseWin)} · Feature{' '}
                    {entry.featureWin === null ? 'pending' : formatCredits(entry.featureWin)}
                    {entry.evidenceBonus > 0
                      ? ` · Notes ${formatCredits(entry.evidenceBonus)}`
                      : ''}
                  </small>
                </div>
                <b>{entry.net >= 0 ? '+' : ''}{formatCredits(entry.net)}</b>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  )
}

function CreditStat({
  label,
  value,
  signed = false,
  pending = false,
}: {
  label: string
  value: number | null
  signed?: boolean
  pending?: boolean
}) {
  const formatted =
    pending || value === null
      ? 'pending'
      : `${signed && value > 0 ? '+' : ''}${formatCredits(value)}`
  return (
    <div className={value !== null && value < 0 ? 'credit-stat negative' : 'credit-stat'}>
      <span>{label}</span>
      <strong>{formatted}</strong>
    </div>
  )
}

function SimulationPanel({
  result,
  isRunning,
  onRun,
  onExport,
  onImport,
  configNotice,
  config,
  onConfigChange,
  targets,
  onTargetsChange,
  onRunSweep,
  isTuning,
  sweepResults,
  onApplySweepConfig,
}: {
  result: SimulationResult | null
  isRunning: boolean
  onRun: (spins: number, seed: number) => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  configNotice: string | null
  config: GameConfig
  onConfigChange: (config: GameConfig) => void
  targets: TuningTargets
  onTargetsChange: (targets: TuningTargets) => void
  onRunSweep: (spins: number, seed: number) => void
  isTuning: boolean
  sweepResults: TuningSweepResult[]
  onApplySweepConfig: (config: GameConfig) => void
}) {
  const [seed, setSeed] = useState('424242')
  const [volume, setVolume] = useState('100000')
  const parsedSeed = Number.parseInt(seed, 10)
  const validSeed = Number.isFinite(parsedSeed)
  const spinCount = Number.parseInt(volume, 10)

  return (
    <aside className="simulation-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Field analysis</span>
          <h2>Math Survey</h2>
        </div>
        <span className="seed">Tuning rig</span>
      </div>
      <p>
        Run the production engine headlessly with a reproducible seed.
      </p>
      <div className="simulation-controls">
        <label>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>
        <label>
          Volume
          <select value={volume} onChange={(event) => setVolume(event.target.value)}>
            <option value="10000">10K</option>
            <option value="100000">100K</option>
            <option value="1000000">1M</option>
          </select>
        </label>
      </div>
      <button
        className="simulate-button"
        onClick={() => onRun(spinCount, parsedSeed)}
        disabled={isRunning || !validSeed}
      >
        {isRunning ? 'Surveying…' : `Run ${Number(spinCount).toLocaleString()} spins`}
      </button>
      <button
        className="simulate-button secondary"
        onClick={() => onRunSweep(spinCount, parsedSeed + 9000)}
        disabled={isTuning || !validSeed}
      >
        {isTuning ? 'Sweeping presets…' : 'Run tuning sweep'}
      </button>
      <div className="config-actions">
        <button onClick={onExport}>Export JSON</button>
        <label>
          Import JSON
          <input type="file" accept="application/json,.json" onChange={onImport} />
        </label>
      </div>
      {configNotice && <div className="config-notice">{configNotice}</div>}

      <TuningWorkspace
        config={config}
        onConfigChange={onConfigChange}
        targets={targets}
        onTargetsChange={onTargetsChange}
        sweepResults={sweepResults}
        onApplySweepConfig={onApplySweepConfig}
      />

      {result ? (
        <div className="metrics">
          <Metric label="Base RTP" value={formatPercent(result.baseRtp)} />
          <Metric label="Evidence RTP" value={formatPercent(result.evidenceRtp)} />
          <Metric label="Feature RTP" value={formatPercent(result.featureRtp)} />
          <Metric label="Total RTP estimate" value={formatPercent(result.totalRtp)} featured />
          <Metric label="Wild appearance" value={formatPercent(result.wildAppearanceRate)} />
          <Metric
            label="Wild-assisted clusters"
            value={formatPercent(result.wildAssistedClusterFrequency)}
          />
          <Metric label="Golden Amber hits" value={formatPercent(result.goldenAmberHitFrequency)} />
          <Metric
            label="Evidence bonus hit"
            value={formatPercent(result.evidenceBonusFrequency)}
          />
          <Metric label="Feature triggers" value={formatPercent(result.triggerFrequency)} />
          <Metric label="Average feature" value={result.averageFeatureWin.toFixed(2)} />
          <small className="sample-note">
            Seed {result.seed} · {result.triggers.toLocaleString()} features in{' '}
            {result.spins.toLocaleString()} spins
          </small>
        </div>
      ) : (
        <div className="empty-analysis">
          <span>∿</span>
          Awaiting expedition data
        </div>
      )}
    </aside>
  )
}

function TuningWorkspace({
  config,
  onConfigChange,
  targets,
  onTargetsChange,
  sweepResults,
  onApplySweepConfig,
}: {
  config: GameConfig
  onConfigChange: (config: GameConfig) => void
  targets: TuningTargets
  onTargetsChange: (targets: TuningTargets) => void
  sweepResults: TuningSweepResult[]
  onApplySweepConfig: (config: GameConfig) => void
}) {
  const setSymbolWeight = (symbol: SymbolId, weight: number) => {
    onConfigChange(
      updateConfigNumber(config, (draft) => {
        draft.symbolWeights = draft.symbolWeights.map((entry) =>
          entry.symbol === symbol ? { ...entry, weight } : entry,
        )
      }),
    )
  }

  const setClusterPay = (table: 'low' | 'premium', index: number, value: number) => {
    onConfigChange(
      updateConfigNumber(config, (draft) => {
        draft.clusterPays[table][index] = value
      }),
    )
  }

  const setTile = (
    tileId: string,
    field: 'rarityWeight' | 'payoutValue',
    value: number,
  ) => {
    onConfigChange(
      updateConfigNumber(config, (draft) => {
        draft.featureProfile.tileTable = draft.featureProfile.tileTable.map((tile) =>
          tile.id === tileId ? { ...tile, [field]: value } : tile,
        )
      }),
    )
  }

  const setFeatureValue = (
    field: 'hitProbability' | 'multiHitProbability',
    value: number,
  ) => {
    onConfigChange(
      updateConfigNumber(config, (draft) => {
        draft.featureProfile.hitGeneration[field] = value
      }),
    )
  }

  return (
    <div className="tuning-workspace">
      <div className="tuning-heading">
        <span>RTP tuning workspace</span>
        <small>Fossil Valley only</small>
      </div>

      <div className="tuning-section">
        <h3>Base symbol weights</h3>
        <div className="tuning-grid two">
          {config.symbolWeights.map((entry) => (
            <NumberControl
              key={entry.symbol}
              label={SYMBOL_DISPLAY[entry.symbol].label}
              value={entry.weight}
              min={0}
              step={0.1}
              onChange={(value) => setSymbolWeight(entry.symbol, value)}
            />
          ))}
        </div>
      </div>

      <div className="tuning-section">
        <h3>Cluster paytables</h3>
        <div className="paytable-editor">
          {(['low', 'premium'] as const).map((table) => (
            <div key={table}>
              <strong>{table}</strong>
              {config.clusterPays[table].map((value, index) => (
                <NumberControl
                  key={`${table}-${index}`}
                  label={`${index + 4}${index === 4 ? '+' : ''} cells`}
                  value={value}
                  min={0}
                  step={0.1}
                  onChange={(next) => setClusterPay(table, index, next)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="tuning-section">
        <h3>Fossil Valley feature</h3>
        <div className="tuning-grid two">
          <NumberControl
            label="Hit probability %"
            value={config.featureProfile.hitGeneration.hitProbability * 100}
            min={0}
            max={100}
            step={0.1}
            onChange={(value) => setFeatureValue('hitProbability', value / 100)}
          />
          <NumberControl
            label="Multi-hit probability %"
            value={config.featureProfile.hitGeneration.multiHitProbability * 100}
            min={0}
            max={100}
            step={0.1}
            onChange={(value) => setFeatureValue('multiHitProbability', value / 100)}
          />
          <NumberControl
            label="Completion reward"
            value={config.featureProfile.completionReward}
            min={0}
            step={1}
            onChange={(value) =>
              onConfigChange(
                updateConfigNumber(config, (draft) => {
                  draft.featureProfile.completionReward = value
                }),
              )
            }
          />
        </div>
      </div>

      <div className="tuning-section">
        <h3>Tile payouts / weights</h3>
        <div className="tile-editor">
          {config.featureProfile.tileTable.map((tile) => (
            <div className="tile-tuning-row" key={tile.id}>
              <span>
                {tile.displayName}
                <small>{tile.rarity}</small>
              </span>
              <NumberControl
                label="Pay"
                value={tile.payoutValue}
                min={0}
                step={0.1}
                onChange={(value) => setTile(tile.id, 'payoutValue', value)}
              />
              <NumberControl
                label="Wt"
                value={tile.rarityWeight}
                min={0}
                step={0.1}
                onChange={(value) => setTile(tile.id, 'rarityWeight', value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="tuning-section">
        <h3>Target bands</h3>
        <TargetControl
          label="Base RTP"
          range={targets.baseRtp}
          onChange={(side, value) =>
            onTargetsChange(updateTarget(targets, 'baseRtp', side, value))
          }
        />
        <TargetControl
          label="Feature RTP"
          range={targets.featureRtp}
          onChange={(side, value) =>
            onTargetsChange(updateTarget(targets, 'featureRtp', side, value))
          }
        />
        <TargetControl
          label="Total RTP"
          range={targets.totalRtp}
          onChange={(side, value) =>
            onTargetsChange(updateTarget(targets, 'totalRtp', side, value))
          }
        />
        <TargetControl
          label="Trigger rate"
          range={targets.triggerFrequency}
          onChange={(side, value) =>
            onTargetsChange(updateTarget(targets, 'triggerFrequency', side, value))
          }
        />
        <TargetControl
          label="Avg feature"
          range={targets.averageFeatureWin}
          percent={false}
          onChange={(side, value) =>
            onTargetsChange(
              updateTarget(targets, 'averageFeatureWin', side, value, false),
            )
          }
        />
        <TargetControl
          label="Median"
          range={targets.medianFeatureWin}
          percent={false}
          onChange={(side, value) =>
            onTargetsChange(
              updateTarget(targets, 'medianFeatureWin', side, value, false),
            )
          }
        />
        <TargetControl
          label="P99"
          range={targets.p99FeatureWin}
          percent={false}
          onChange={(side, value) =>
            onTargetsChange(updateTarget(targets, 'p99FeatureWin', side, value, false))
          }
        />
      </div>

      {sweepResults.length > 0 && (
        <div className="tuning-section">
          <h3>Closest sweep configurations</h3>
          <div className="sweep-list">
            {sweepResults.map((result, index) => (
              <div className="sweep-card" key={`${result.name}-${index}`}>
                <div>
                  <strong>#{index + 1} · score {result.score.toFixed(2)}</strong>
                  <span>{result.name}</span>
                </div>
                <small>
                  Base {formatPercent(result.simulation.baseRtp)} · Feature{' '}
                  {formatPercent(result.simulation.featureRtp)} · Total{' '}
                  {formatPercent(result.simulation.totalRtp)} · Trigger{' '}
                  {formatOdds(result.simulation.triggerFrequency)} · Avg{' '}
                  {result.simulation.averageFeatureWin.toFixed(1)}x · Median{' '}
                  {result.simulation.percentiles.p50.toFixed(1)}x · P99{' '}
                  {result.simulation.percentiles.p99.toFixed(1)}x
                </small>
                <button onClick={() => onApplySweepConfig(result.config)}>
                  Apply config
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NumberControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isInteger(value) ? value : Number(value.toFixed(4))}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function TargetControl({
  label,
  range,
  percent = true,
  onChange,
}: {
  label: string
  range: TargetRange
  percent?: boolean
  onChange: (side: keyof TargetRange, value: number) => void
}) {
  return (
    <div className="target-control">
      <span>{label}</span>
      <input
        type="number"
        value={percent ? Number((range.min * 100).toFixed(4)) : range.min}
        step={percent ? 0.1 : 1}
        onChange={(event) => onChange('min', Number(event.target.value))}
      />
      <input
        type="number"
        value={percent ? Number((range.max * 100).toFixed(4)) : range.max}
        step={percent ? 0.1 : 1}
        onChange={(event) => onChange('max', Number(event.target.value))}
      />
    </div>
  )
}

function Diagnostics({
  result,
  targets,
}: {
  result: SimulationResult
  targets: TuningTargets
}) {
  const warnings: string[] = []
  if (result.totalRtp < 0.85 || result.totalRtp > 0.98) {
    warnings.push(
      `Total RTP ${formatPercent(result.totalRtp)} is outside the 85–98% diagnostic range.`,
    )
  }
  if (result.spins < 100_000) {
    warnings.push('Sample size is exploratory. Use at least 100K spins for tuning decisions.')
  }

  return (
    <section className="diagnostics-panel">
      <div className="diagnostics-heading">
        <div>
          <span className="eyebrow">Measurement report</span>
          <h2>Engine Diagnostics</h2>
        </div>
        <span>{result.spins.toLocaleString()} spins · seed {result.seed}</span>
      </div>

      {warnings.length > 0 && (
        <div className="warning-stack">
          {warnings.map((warning) => (
            <div className="warning" key={warning}>⚠ {warning}</div>
          ))}
        </div>
      )}

      <div className="diagnostic-summary">
        <TargetMetric
          label="Base RTP"
          value={result.baseRtp}
          display={formatPercent(result.baseRtp)}
          range={targets.baseRtp}
        />
        <Metric label="Evidence RTP" value={formatPercent(result.evidenceRtp)} />
        <Metric
          label="Evidence bonus hit"
          value={formatPercent(result.evidenceBonusFrequency)}
        />
        <Metric
          label="Avg evidence bonus"
          value={result.averageEvidenceBonus.toFixed(2)}
        />
        <Metric label="Wild appearance" value={formatPercent(result.wildAppearanceRate)} />
        <Metric
          label="Wild-assisted cluster"
          value={formatPercent(result.wildAssistedClusterFrequency)}
        />
        <Metric label="Golden Amber hit" value={formatPercent(result.goldenAmberHitFrequency)} />
        <Metric label="Largest base hit" value={result.largestBaseGameHit.toFixed(2)} />
        <Metric label="Base win P95" value={result.baseWinPercentiles.p95.toFixed(2)} />
        <Metric label="Base win P99" value={result.baseWinPercentiles.p99.toFixed(2)} />
        <Metric label="3 evidence" value={formatPercent(result.evidenceUniqueDistribution['3'])} />
        <Metric label="4 evidence" value={formatPercent(result.evidenceUniqueDistribution['4'])} />
        <Metric label="5 evidence" value={formatPercent(result.evidenceUniqueDistribution['5'])} />
        <TargetMetric
          label="Feature RTP"
          value={result.featureRtp}
          display={formatPercent(result.featureRtp)}
          range={targets.featureRtp}
        />
        <TargetMetric
          label="Total RTP"
          value={result.totalRtp}
          display={formatPercent(result.totalRtp)}
          range={targets.totalRtp}
        />
        <TargetMetric
          label="Trigger rate"
          value={result.triggerFrequency}
          display={`${formatPercent(result.triggerFrequency)} · ${formatOdds(result.triggerFrequency)}`}
          range={targets.triggerFrequency}
        />
        <Metric label="Avg clusters / spin" value={(result.totalClusters / result.spins).toFixed(3)} />
        <TargetMetric
          label="Avg feature"
          value={result.averageFeatureWin}
          display={result.averageFeatureWin.toFixed(2)}
          range={targets.averageFeatureWin}
          percent={false}
        />
        <TargetMetric
          label="Median feature"
          value={result.percentiles.p50}
          display={result.percentiles.p50.toFixed(2)}
          range={targets.medianFeatureWin}
          percent={false}
        />
        <Metric label="P90 feature" value={result.percentiles.p90.toFixed(2)} />
        <TargetMetric
          label="P99 feature"
          value={result.percentiles.p99}
          display={result.percentiles.p99.toFixed(2)}
          range={targets.p99FeatureWin}
          percent={false}
        />
        <Metric label="Full reveal rate" value={formatPercent(result.fullRevealRate)} />
      </div>

      <div className="distribution-grid">
        <Distribution title="Footprint count / spin" values={result.footprintDistribution} />
        <Distribution
          title="Unique evidence / spin"
          values={result.evidenceUniqueDistribution}
        />
        <Distribution title="Paying clusters / spin" values={result.clusterCountDistribution} />
        <Distribution title="Paying cluster sizes" values={result.clusterSizeDistribution} />
        <Distribution
          title="Symbol frequency"
          values={Object.fromEntries(
            Object.entries(result.symbolFrequencyDistribution).map(([symbol, value]) => [
              SYMBOL_DISPLAY[symbol as SymbolId].label,
              value,
            ]),
          )}
        />
        <Distribution
          title="Final reveal count"
          values={result.finalRevealDistribution}
          wide
        />
      </div>

      <div className="target-note">
        <strong>Active target</strong>
        <span>
          Base {formatTargetRange(targets.baseRtp)} · Feature{' '}
          {formatTargetRange(targets.featureRtp)} · Total {formatTargetRange(targets.totalRtp)} ·
          Trigger {formatOdds(targets.triggerFrequency.max)}–{formatOdds(targets.triggerFrequency.min)} ·
          Avg {formatTargetRange(targets.averageFeatureWin, false)}x · Median{' '}
          {formatTargetRange(targets.medianFeatureWin, false)}x · P99{' '}
          {formatTargetRange(targets.p99FeatureWin, false)}x
        </span>
      </div>
    </section>
  )
}

function TargetMetric({
  label,
  value,
  display,
  range,
  percent = true,
}: {
  label: string
  value: number
  display: string
  range: TargetRange
  percent?: boolean
}) {
  const status = describeMetricStatus(value, range)
  return (
    <div className={`metric target-metric status-${status}`}>
      <span>{label}</span>
      <strong>{display}</strong>
      <small>
        {status} · target {formatTargetRange(range, percent)}
      </small>
    </div>
  )
}

function Distribution({
  title,
  values,
  wide = false,
}: {
  title: string
  values: Record<string, number>
  wide?: boolean
}) {
  return (
    <div className={`distribution ${wide ? 'wide' : ''}`}>
      <h3>{title}</h3>
      <div className="distribution-rows">
        {Object.entries(values).map(([label, value]) => (
          <div className="distribution-row" key={label}>
            <span>{label}</span>
            <div><i style={{ width: `${Math.max(value * 100, value > 0 ? 1 : 0)}%` }} /></div>
            <strong>{formatPercent(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  featured = false,
}: {
  label: string
  value: string
  featured?: boolean
}) {
  return (
    <div className={`metric ${featured ? 'featured' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
