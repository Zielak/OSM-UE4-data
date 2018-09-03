import logUpdate from 'log-update'
import { WorkerState } from './types'
import { limit, wrap } from './utils'
import c from 'chalk'

const PROGRESS_BAR_WIDTH = 30
const CHAR_BG = '═'
const CHAR_DONE = '■'
const CHAR_EDGE = '►'
const CHAR_TICK = '√'

const drawProgressBar = (percentage) => {
  if (percentage !== percentage || typeof percentage !== 'number') {
    return c.red(CHAR_BG.repeat(PROGRESS_BAR_WIDTH))
  }
  percentage = limit(percentage, 0, 100)
  const barsCompleted = Math.floor(PROGRESS_BAR_WIDTH * (percentage / 100))
  return (
    c.yellow(CHAR_DONE.repeat(barsCompleted)) +
    c.yellow(CHAR_EDGE) +
    c.grey(CHAR_BG.repeat(PROGRESS_BAR_WIDTH - barsCompleted - 1))
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
  interval: NodeJS.Timer

  constructor(workers: Array<WorkerState>) {
    for (let i = 0; i < workers.length; i++) {
      this.workersData.set(i, workers[i])
    }

    let frame = 0
    this.interval = setInterval(() => {
      const spinner = spinnerFrames[frame = ++frame % spinnerFrames.length]
      let rows = ''
      this.workersData.forEach((worker: WorkerState, idx) => {
        const length = worker.preparedByteEnd - worker.preparedByteStart
        const percentage = worker.currentByte / length

        const idxPrefix = idx <= 9 ? c.grey('0') : ''
        const workerID = idxPrefix + c.greenBright.bold('' + idx)

        const icon = worker.finished ? CHAR_TICK : spinner

        const bar = worker.finished ? drawFinishedBar() : drawProgressBar(percentage)

        rows += `worker [${workerID}] ${icon} ${bar}\n`
      })

      logUpdate(rows)
    }, 100)
  }

  updateWorker(idx: number, data: WorkerState) {
    this.workersData.set(idx, data)
  }


}

const workersProgress = []

const spinnerFrames = ['-', '\\', '|', '/']
let i = 0



export default VisualProgress
