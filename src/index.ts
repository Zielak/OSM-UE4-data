import * as fs from 'fs'
import requestData from './requestData'
import localData from './localData'
import { GeometryItem } from './types'

import { fork, ChildProcess } from 'child_process'
import os from 'os'
import { WorkerMessage } from './worker'

// npm start -- C:/OSM/outputTFWaysBuilding.osm.xml buildingsOsmosis.json --workers=2

const args = new Map<string, string>()
// Default values
args.set('input', 'C:/OSM/outputTFWaysBuilding.osm.xml')
args.set('output', 'buildingsOsmosis.json')
args.set('--workers', '2')
process.argv.forEach((val, index, array) => {
  if (index <= 1) return
  if (index === 2) args.set('input', val)
  if (index === 3) args.set('output', val)
  const keyValue = val.split('=')
  args.set(keyValue[0], keyValue[1])
})

const OUTPUT_DIR = `${__dirname}/../data/`
const numCPUs = os.cpus().length
const workers: Array<ChildProcess> = []
const maxWorkers = Math.min(numCPUs, +args.get('--workers') || numCPUs)
const inputFileSize = fs.statSync(args.get('input')).size
const inputChunkSize = Math.round(inputFileSize / maxWorkers)

const nodesMemory = new Map<number, GeometryItem>()

for (var i = 0; i < maxWorkers; i++) {
  workers.push(fork('src/worker.ts'))
}
workers.forEach((worker, idx) => {
  worker.on('message', (msg: WorkerMessage) => {
    switch (msg.type) {
      // case 'data': console.log(`data from [${idx}]: `, msg.data); break
      case 'rememberNode': nodesMemory.set(msg.data.id, msg.data.node); break
      case 'error': console.log(`ERROR on worker [${idx}]`, msg.data); break
      case 'debug': console.log(`  [${idx}] - `, msg.data); break
    }
    // console.log(`Message from child[${idx}: ${JSON.stringify(msg)}`);
  })
  worker.on('exit', msg => {
    console.log(`worker [${idx}] finished`)
  })

  worker.send({
    type: 'init',
    inputPath: args.get('input'),
    start: inputChunkSize * idx,
    end: inputChunkSize * idx + inputChunkSize
  })
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
      console.log('ERROR saving to file!', error)
      return
    }
    console.log('done saving to file')
  })
}


// localData('C:/OSM/poland/outputTFWaysBuilding.osm.xml').then(saveTo('buildingsPolandOsmosis.json'))

// requestData(queries.buildings, bbox).then(saveTo('buildingsOverpass.json'))
// requestData(queries.countries, bbox).then(saveTo('countries.json'))
