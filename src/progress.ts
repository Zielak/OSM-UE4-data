import logUpdate from 'log-update'
import { WorkerState } from './types'
import { limit, wrap } from './utils'
import c from 'chalk'

const PROGRESS_BAR_WIDTH = 40
const CHAR_BG = '═'
const CHAR_DONE = '■'
const CHAR_EDGE = '►'
const CHAR_TICK = '√'
const SPINNER = '░░░░▒▒▓█▓▒▒░░░░'.split('')
const getSpinnerFrame = val => SPINNER[wrap(val, 0, SPINNER.length)]

const drawProgressBar = (percentage) => {
  if (percentage !== percentage || typeof percentage !== 'number') {
    return c.red(CHAR_BG.repeat(PROGRESS_BAR_WIDTH))
  }
  percentage = limit(percentage, 0, 100)
  const barsCompleted = Math.floor(PROGRESS_BAR_WIDTH * (percentage / 100))
  return (
    c.yellow(CHAR_DONE.repeat(barsCompleted)) +
    c.yellow(CHAR_EDGE) +
    c.grey(CHAR_BG.repeat(Math.max(0, PROGRESS_BAR_WIDTH - barsCompleted - 1)))
  )
}

const drawFinishedBar = () => {
  return c.green(CHAR_DONE.repeat(PROGRESS_BAR_WIDTH))
}

// for (let index = 0; index < 100; index++) {
//   console.log(drawProgressBar(index))
// }

class VisualProgress {

  workersData: Map<number, WorkerState> = new Map()
  nodesCount: number = 0
  lastNodesCount: number = 0
  interval: NodeJS.Timer

  constructor(workers: Array<WorkerState>) {
    for (let i = 0; i < workers.length; i++) {
      this.workersData.set(i, workers[i])
    }

    let frame = 0
    this.interval = setInterval(() => {
      frame = ++frame % SPINNER.length
      let rows = ''
      this.workersData.forEach((worker: WorkerState, idx) => {
        const length = worker.preparedByteEnd - worker.preparedByteStart
        const percentage = (worker.currentByte - worker.preparedByteStart) / length * 100

        const idxPrefix = idx <= 9 ? c.grey('0') : ''
        const workerID = idxPrefix + c.greenBright.bold('' + idx)

        const icon = worker.finished ? CHAR_TICK : getSpinnerFrame(idx + frame)

        const bar = worker.finished ? drawFinishedBar() : drawProgressBar(percentage)

        // const debug = `${worker.preparedByteStart}-${worker.preparedByteEnd}@${worker.currentByte}`
        // const debug = `${percentage} = (${worker.currentByte} - ${worker.preparedByteStart}) / ${length}`

        rows += `worker [${workerID}] ${icon} ${bar}\n`
      })

      const nodes = `${this.nodesCount.toLocaleString()} ${this.nodesCount - this.lastNodesCount}/sec`

      const print = `    remembered <node>'s: ${nodes}
${rows}`

      logUpdate(print)
    }, 80)
  }

  updateWorker(idx: number, data: WorkerState) {
    this.workersData.set(idx, data)
  }

  /**
   * Remember to update once a second plz.
   * @param val 
   */
  updateNodesCount(val: number) {
    this.lastNodesCount = this.nodesCount
    this.nodesCount = val
  }

}

const workersProgress = []

export default VisualProgress
