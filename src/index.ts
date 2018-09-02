import * as fs from 'fs'
import c from 'chalk'
import { GeometryItem, WorkerState } from './types'

import { fork, ChildProcess } from 'child_process'
import os from 'os'
import { WorkerMessage } from './worker'

// npm start -- C:/OSM/outputTFWaysBuilding.osm.xml buildingsOsmosis.json --workers=2

const args = new Map<string, string>()
// Default values
args.set('input', 'C:/OSM/outputTFWaysBuilding.osm.xml')
args.set('output', 'buildingsOsmosis.json')
args.set('--workers', '12')
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

const nodesMemory = new Map<number, GeometryItem>()

const allWorkersPrepared = () => workers.every(({ state }) => state.prepared)
/**
 * Worker will get back with 'prepared' event once
 * it finds itcelf with proper xml tag begining.
 */
const workerPrepared = (state: WorkerState, offset: number, workerIdx: number) => {
  console.log(c.bold.greenBright(`Worker [${workerIdx}] reported back with ${offset} bytes offset`))
  state.prepared = true
  state.preparedByteStart = offset
  if (allWorkersPrepared()) {
    console.log(c.bold.greenBright('### ALL WORKERS READY ###'))
    allStartWorking()
  }
}
const allStartWorking = () => workers.forEach(({ state, worker }) => {
  worker.send({
    type: 'start',
    start: state.preparedByteStart,
    end: state.preparedByteEnd
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
      case 'prepared':
        workerPrepared(state, msg.data, idx)
        break
      case 'rememberNode':
        nodesMemory.set(msg.data.id, msg.data.node)
        break
      case 'error':
        console.log(c.red(`ERROR on worker [${idx}]`), msg.data)
        break
      case 'debug':
        console.log(c.cyan(`  [${idx}] - `), msg.data)
        break
    }
    // console.log(`Message from child[${idx}: ${JSON.stringify(msg)}`);
  })
  worker.on('exit', msg => {
    state.finished = true
    console.log(c.bold(`worker [${idx}] finished`))
  })

  if (idx === 0) {
    // Only the first one should get file header
    worker.send({
      type: 'seekHeader',
      inputPath: args.get('input'),
      start: inputChunkSize * idx,
      end: inputChunkSize * idx + inputChunkSize,
      recordRegex: "(node|way)"
    })
  }
  if (idx > 0) {
    // The rest should seek their startBytes offset
    worker.send({
      type: 'prepare',
      inputPath: args.get('input'),
      start: inputChunkSize * idx,
      end: inputChunkSize * idx + inputChunkSize,
      recordRegex: "(node|way)"
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
