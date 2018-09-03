import * as fs from 'fs'
import c from 'chalk'
import { fork, ChildProcess } from 'child_process'
import os from 'os'

import { GeometryItem, WorkerState } from './types'
import { WorkerMessage } from './worker'
import VisualProgress from './progress'

const args = new Map<string, string>()
// Default values
args.set('input', 'C:/OSM/outputTFWaysBuilding.osm.xml')
args.set('output', 'buildingsOsmosis.json')
args.set('--workers', '3')
process.argv.forEach((val, index, array) => {
  if (index <= 1) return
  if (index === 2) args.set('input', val)
  if (index === 3) args.set('output', val)
  const keyValue = val.split('=')
  args.set(keyValue[0], keyValue[1])
})

const OUTPUT_DIR = `${__dirname}/../data/`
const numCPUs = os.cpus().length
const workers: Array<{ worker: ChildProcess, state: WorkerState }> = []
const maxWorkers = Math.min(numCPUs, +args.get('--workers') || numCPUs)
const inputFileSize = fs.statSync(args.get('input')).size
const inputChunkSize = Math.round(inputFileSize / maxWorkers)

let visualProgress: VisualProgress
const nodesMemory = new Map<number, GeometryItem>()

const areAllWorkersPrepared = () => workers.every(({ state }) => state.prepared)

const workerPrepared = (state: WorkerState) => {
  state.prepared = true
  if (areAllWorkersPrepared()) {
    console.log(c.bold.greenBright(`\n### ALL WORKERS READY ###\n`))
    allWorkersPrepareOffset()
    allWorkersStart()
    visualProgress = new VisualProgress(workers.map(el => el.state))
  }
}

const workerFoundHeader = (state: WorkerState, msg: WorkerMessage, workerIdx: number) => {
  console.log(c.bold.greenBright(`Worker [${workerIdx}] found file's header and root element's tagname : <${msg.rootTagName}> :
${msg.xmlHeader}`))

  // First worker updates the state of all others (and itself)
  workers.forEach(({ state }, idx, workers) => {
    if (idx > 0) state.xmlHeader = msg.xmlHeader
    if (idx <= workers.length - 1) state.rootTagName = msg.rootTagName
  })

  workerPrepared(state)
}

/**
 * Worker will get back with 'prepared' event once
 * it finds itcelf with proper xml tag begining.
 */
const workerReportsPrepared = (state: WorkerState, offset: number, workerIdx: number) => {
  console.log(c.bold.greenBright(`Worker [${workerIdx}] reported back with ${offset} bytes offset`))
  state.preparedByteStartOffset = offset
  workerPrepared(state)
}

const allWorkersPrepareOffset = () => {
  console.log(`got ${workers.length} workers`)
  workers.forEach(({ state }, idx, workers) => {
    if (idx === 0) {
      // We already know the begining
      state.preparedByteStart = state.initialByteStart
      return
    }
    let lastWorkerState = workers[idx - 1].state
    if (idx === workers.length - 1) {
      // We already know the ending
      state.preparedByteEnd = state.initialByteEnd
    }
    state.preparedByteStart = state.initialByteStart + state.preparedByteStartOffset
    console.log(`  w${idx - 1} preparedEnd: ${lastWorkerState.preparedByteEnd}`)
    lastWorkerState.preparedByteEnd = lastWorkerState.initialByteEnd + state.preparedByteStartOffset - 1
    console.log(`  w${idx - 1}       \`--->: ${lastWorkerState.preparedByteEnd}`)
  })
}

const allWorkersStart = () => workers.forEach(({ state, worker }, idx) => {
  console.log(`[${idx}] = {
  currentByte: ${state.currentByte},
  initial : ${state.initialByteStart}\t${state.initialByteEnd},
  prepared: ${state.preparedByteStart}\t${state.preparedByteEnd}
},`)

  worker.send({
    type: 'start',
    inputPath: args.get('input'),
    start: state.preparedByteStart,
    end: state.preparedByteEnd,
    xmlHeader: state.xmlHeader,
    rootTagName: state.rootTagName
  })
})

for (var i = 0; i < maxWorkers; i++) {
  console.log('spawning worker ' + i)
  workers.push({
    worker: fork('src/worker.ts'),
    state: {
      prepared: false,
      finished: false
    }
  })
}
workers.forEach(({ worker, state }, idx) => {
  worker.on('message', (msg: WorkerMessage) => {
    switch (msg.type) {
      // case 'data': console.log(`data from [${idx}]: `, msg.data); break
      case 'foundHeader':
        workerFoundHeader(state, msg, idx)
        break
      case 'prepared':
        workerReportsPrepared(state, msg.data, idx)
        break
      case 'progress':
        console.log(`${idx}, progress: ${msg.data}`)
        state.currentByte = msg.data
        visualProgress.updateWorker(idx, state)
      case 'rememberNode':
        nodesMemory.set(msg.data.id, msg.data.node)
        break
      case 'error':
        console.log(c.red(`ERROR on worker [${idx}]`), JSON.stringify(msg.data))
        break
      case 'debug':
        console.log(c.cyan(`  [${idx}] - `), msg.data)
        break
    }
    // console.log(`Message from child[${idx}: ${JSON.stringify(msg)}`);
  })
  worker.on('exit', () => {
    state.finished = true
    console.log(c.bold(`worker [${idx}] finished`))
    visualProgress.updateWorker(idx, state)
  })

  if (idx === 0) {
    // Only the first one should get file header
    state.initialByteStart = 0
    state.initialByteEnd = inputChunkSize * idx + inputChunkSize
    worker.send({
      type: 'seekHeader',
      inputPath: args.get('input'),
      start: state.initialByteStart,
      end: state.initialByteEnd
    })
  }
  if (idx > 0) {
    // The rest should seek their startBytes offset
    state.initialByteStart = inputChunkSize * idx
    state.initialByteEnd = inputChunkSize * idx + inputChunkSize
    worker.send({
      type: 'prepare',
      inputPath: args.get('input'),
      start: state.initialByteStart,
      end: state.initialByteEnd,
      recordRegexp: '(node|way)'
    })
  }
})

/**
 * 1. get the bbox from important data
 * 2. get all data from Overpass:
 * 3. seperate it to nodes/ways/rels ?
 * 4. store data in UE4-friendly JSON format (or csv?)
 */

// TODO: get from args?
// Osiedla: 50.29699541650302,19.13441777229309,50.2998019107882,19.137722253799435
// Cała Polska: 48.922499263758255,14.084472656249998,54.91451400766527,24.14794921875
// Pierwszy kawałek polski: 52.68304276227741,14.084472656249998,54.91451400766527,17.5341796875
const bboxInput = `50.29699541650302,19.13441777229309,50.2998019107882,19.137722253799435`.split(',')

const bbox = {
  minlat: bboxInput[0],
  minlon: bboxInput[1],
  maxlat: bboxInput[2],
  maxlon: bboxInput[3]
}

// OverpassFrontend adds other required fields to the query
// like bbox and output format
const queries = {
  buildings: `way[building];`,
  countries: `way[admin_level=2]`
}

// TODO: Streamify it? Can't wait for the whole dump to save...
const saveTo = fileName => data => {
  const json = JSON.stringify(data)
  const targetFile = `${OUTPUT_DIR}${fileName}`
  // if (!fs.existsSync(targetFile)) {
  //   fs.
  // }
  fs.writeFile(targetFile, json, 'utf8', error => {
    if (error) {
      console.log(c.bgRed.white.bold('ERROR saving to file!'), error)
      return
    }
    console.log(c.bgGreen.white.bold('done saving to file'))
  })
}


// localData('C:/OSM/poland/outputTFWaysBuilding.osm.xml').then(saveTo('buildingsPolandOsmosis.json'))

// requestData(queries.buildings, bbox).then(saveTo('buildingsOverpass.json'))
// requestData(queries.countries, bbox).then(saveTo('countries.json'))
