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
): symbol is Exclude<SymbolId, 'footprint' | 'campWild'> {
  return symbol !== 'footprint' && symbol !== 'campWild'
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

export function calculateClusterWins(
  board: Board,
  config: GameConfig,
): { wins: ClusterWin[]; total: number } {
  const wins: ClusterWin[] = []
  const exactVisited = board.map((row) => row.map(() => false))

  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      if (exactVisited[row][column]) continue

      const symbol = board[row][column]
      exactVisited[row][column] = true
      if (!isPayingSymbol(symbol) || EVIDENCE_SYMBOL_SET.has(symbol)) continue

      const cells: CellPosition[] = []
      const pending: CellPosition[] = [{ row, column }]

      while (pending.length > 0) {
        const cell = pending.pop()!
        cells.push(cell)

        for (const [rowOffset, columnOffset] of DIRECTIONS) {
          const nextRow = cell.row + rowOffset
          const nextColumn = cell.column + columnOffset
          if (
            nextRow < 0 ||
            nextRow >= board.length ||
            nextColumn < 0 ||
            nextColumn >= board[nextRow].length ||
            exactVisited[nextRow][nextColumn] ||
            board[nextRow][nextColumn] !== symbol
          ) {
            continue
          }
          exactVisited[nextRow][nextColumn] = true
          pending.push({ row: nextRow, column: nextColumn })
        }
      }

      if (cells.length >= 4) {
        const payout = config.clusterPays.premium[Math.min(cells.length, 8) - 4]
        wins.push({ symbol, size: cells.length, cells, payout })
      }
    }
  }

  for (const evidenceSymbol of EVIDENCE_SYMBOLS) {
    const visited = board.map((row) => row.map(() => false))

    for (let row = 0; row < board.length; row += 1) {
      for (let column = 0; column < board[row].length; column += 1) {
        if (visited[row][column]) continue
        const symbol = board[row][column]
        if (symbol !== evidenceSymbol && symbol !== 'campWild') continue

        const cells: CellPosition[] = []
        const pending: CellPosition[] = [{ row, column }]
        let naturalEvidenceCount = 0
        visited[row][column] = true

        while (pending.length > 0) {
          const cell = pending.pop()!
          cells.push(cell)
          if (board[cell.row][cell.column] === evidenceSymbol) naturalEvidenceCount += 1

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
            if (nextSymbol !== evidenceSymbol && nextSymbol !== 'campWild') continue
            visited[nextRow][nextColumn] = true
            pending.push({ row: nextRow, column: nextColumn })
          }
        }

        if (naturalEvidenceCount > 0 && cells.length >= 4) {
          const payout = config.clusterPays.low[Math.min(cells.length, 8) - 4]
          wins.push({ symbol: evidenceSymbol, size: cells.length, cells, payout })
        }
      }
    }
  }

  return { wins, total: wins.reduce((sum, win) => sum + win.payout, 0) }
}
