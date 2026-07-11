import type {
  Board,
  CellPosition,
  ClusterWin,
  EvidenceSymbolId,
  GameConfig,
  SymbolId,
} from './types'

function isPayingSymbol(
  symbol: SymbolId,
): symbol is Exclude<SymbolId, 'footprint' | 'predatorTracks' | 'campWild'> {
  return symbol !== 'footprint' && symbol !== 'predatorTracks' && symbol !== 'campWild'
}

function isWild(symbol: SymbolId): boolean {
  return symbol === 'campWild'
}

export const EVIDENCE_SYMBOLS = [
  'trexTooth',
  'raptorClaw',
  'triceratopsEggshell',
  'pterosaurFeather',
  'sauropodHorn',
] as const satisfies readonly EvidenceSymbolId[]

export const EVIDENCE_SYMBOL_SET = new Set<SymbolId>([
  ...EVIDENCE_SYMBOLS,
])

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const

function paytableForSymbol(
  symbol: Exclude<SymbolId, 'footprint' | 'predatorTracks' | 'campWild'>,
  config: GameConfig,
): [number, number, number, number, number] {
  if (EVIDENCE_SYMBOL_SET.has(symbol)) return config.clusterPays.low
  if (symbol === 'goldenAmber') return config.clusterPays.goldenAmber
  return config.clusterPays.premium
}

export function calculateClusterWins(
  board: Board,
  config: GameConfig,
): { wins: ClusterWin[]; total: number } {
  const wins: ClusterWin[] = []
  const targetSymbols = config.symbolWeights
    .map((entry) => entry.symbol)
    .filter(isPayingSymbol)

  for (const targetSymbol of targetSymbols) {
    const visited = board.map((row) => row.map(() => false))

    for (let row = 0; row < board.length; row += 1) {
      for (let column = 0; column < board[row].length; column += 1) {
        if (visited[row][column]) continue
        const symbol = board[row][column]
        if (symbol !== targetSymbol && !isWild(symbol)) continue

        const cells: CellPosition[] = []
        const pending: CellPosition[] = [{ row, column }]
        let naturalSymbolCount = 0
        let wildCount = 0
        visited[row][column] = true

        while (pending.length > 0) {
          const cell = pending.pop()!
          cells.push(cell)
          const currentSymbol = board[cell.row][cell.column]
          if (currentSymbol === targetSymbol) naturalSymbolCount += 1
          if (isWild(currentSymbol)) wildCount += 1

          for (const [rowOffset, columnOffset] of DIRECTIONS) {
            const nextRow = cell.row + rowOffset
            const nextColumn = cell.column + columnOffset
            if (
              nextRow < 0 ||
              nextRow >= board.length ||
              nextColumn < 0 ||
              nextColumn >= board[nextRow].length ||
              visited[nextRow][nextColumn]
            ) {
              continue
            }
            const nextSymbol = board[nextRow][nextColumn]
            if (nextSymbol !== targetSymbol && !isWild(nextSymbol)) continue
            visited[nextRow][nextColumn] = true
            pending.push({ row: nextRow, column: nextColumn })
          }
        }

        if (naturalSymbolCount > 0 && cells.length >= 4) {
          const paytable = paytableForSymbol(targetSymbol, config)
          const payout = paytable[Math.min(cells.length, 8) - 4]
          wins.push({
            symbol: targetSymbol,
            size: cells.length,
            cells,
            payout,
            wildAssisted: wildCount > 0,
          })
        }
      }
    }
  }

  return { wins, total: wins.reduce((sum, win) => sum + win.payout, 0) }
}
