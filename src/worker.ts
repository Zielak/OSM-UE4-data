import c from 'chalk'
import fs from 'fs'
import ipc from 'node-ipc'
import bigXml from './big-xml/big-xml'
import geometryToBoundary from './buildBoundries'
import { JsonXmlObject, JsonXmlChild, UEObject, OSMObjectId, Geometry } from './types'
import { filterWayData, filterNodeData } from './filtersOsmosisJSON'

ipc.config.id = process.argv[2]

const d = (msg) => {
  // process.send({ type: 'debug', data: msg })
}

type StreamLookupOptions = {
  inputPath: string,
  start: number,
  end: number,
  step: (chunk: Buffer) => void
}
type StreamLookupResults = {
  string: string,
  offset: number
}

// The <node> objects that I found in my stream part.
const localNodesMemory = new Map<OSMObjectId, UEObject>()

const incompleteWays = new Map<OSMObjectId, UEObject>()
const localWaysMemory = new Map<OSMObjectId, UEObject>()

const startStreamLookup = async (options: StreamLookupOptions): Promise<StreamLookupResults> => {
  const { inputPath, start, end, step } = options
  let gotIt = false

  const job = new Promise<StreamLookupResults>((resolve, reject) => {
    d(`creating stream: ${inputPath}:${start}-${end}`)
    const stream = fs.createReadStream(inputPath, {
      start: start,
      end: end
    })
    stream.on('close', () => {
      d(c.bgCyan('stram close'))
    })
    stream.on('end', () => {
      d(c.bgCyan('stram ended'))
    })
    stream.on('error', error => {
      d(c.bgRed.whiteBright.bold('stram ERROR: ' + error))
      reject()
    })
    stream.on('readable', () => {
      d('stream readable...')
      let chunk: Buffer

      while (!gotIt && null !== (chunk = stream.read(1))) {
        const result = step(chunk)
        if (result) {
          gotIt = true
          continue
        }
      }
      resolve()
    })
  })
  return await job
}

const seekHeader = (msg: WorkerMessage) => {
  if (!validateFileInput(msg)) return

  const headerRegex = new RegExp(/<\?xml (.*)\?>.*<(\w+)(.*)>/is)
  const inputPath = msg.inputPath

  const LIMIT = 500
  let charPos = 0
  let string = ''
  let rootTagName = ''
  const chunkStep = (chunk: Buffer) => {

    if (charPos > LIMIT) {
      process.send({
        type: 'error',
        data: `After ${LIMIT} characters I still couldn't find the header!
'charPos' = ${charPos}
Here's what I got so far:

${string}
`
      })
      charPos = 0
    }

    string += chunk

    if (headerRegex.test(string)) {
      // if (string.match(headerRegex)) {
      rootTagName = string.match(headerRegex)[2]
      return true
    }

    charPos++
    return false
  }

  startStreamLookup({
    inputPath,
    start: msg.start,
    end: msg.end,
    step: chunkStep,
  }).then(() => {
    process.send({
      type: 'foundHeader',
      xmlHeader: string,
      rootTagName: rootTagName
    })
  })
}

const prepare = (msg: WorkerMessage) => {
  if (!validateFileInput(msg)) return

  const recordRegexp = new RegExp('^' + msg.recordRegexp + '$')
  const inputPath = msg.inputPath

  let isCapturingTagName = false
  let tagName = ''
  let tagStartPos = NaN
  let charPos = 0
  const chunkStep = (chunk: Buffer) => {
    // d(`[${chunk}]`)
    if (isCapturingTagName) {
      tagName += chunk.toString()
      if (isValidTagNameCharacter(chunk.toString())) {
        // d(`  valid tagname char "${chunk.toString()}"`)
        // d(`  tagName so far: "${tagName}"`)
        if (recordRegexp.test(tagName)) {
          // d(`    got the name!: "${tagName}"`)
          // Got the name!
          return true
        }
      } else {
        // No match and hit non tag-name char
        // -> reset and stop capturing.
        // d(`  reset, non xmltagname char: "${chunk.toString()}"`)
        isCapturingTagName = false
        tagName = ''
        tagStartPos = NaN
      }
    }

    if (chunk.toString() === '<') {
      // d(`start capturing...`)
      isCapturingTagName = true
      tagStartPos = charPos
    }

    charPos++
    return false
  }

  startStreamLookup({
    inputPath,
    start: msg.start,
    end: msg.end,
    step: chunkStep,
  }).then(() => {
    process.send({
      type: 'prepared',
      data: tagStartPos
    })
  })
}

const start = (msg: WorkerMessage) => {

  d(`start: ${msg.start}, end: ${msg.end}`)

  let currentByte = msg.start

  const reader = bigXml.createReader(msg.inputPath, msg.recordRegexp, {
    start: msg.start,
    end: msg.end,
    streamPrefix: msg.xmlHeader || '',
    streamSuffix: msg.rootTagName ? `<${msg.rootTagName}/>` : ''
  })

  reader.on('record', (record: JsonXmlObject) => {
    if (record.tag === 'way') {
      const element = filterWayData(record)
      planBuildingGeometry(record.attrs.id, element)
    } else if (record.tag === 'node') {
      const element = filterNodeData(record)
      localNodesMemory.set(record.attrs.id, element)
      process.send({
        type: 'rememberNode',
        data: record.attrs.id
      })
    }
  })

  let delayProgress = 0
  const progressThreshold = 1024 * 10
  reader.on('data', data => {
    currentByte += data.length
    if ((delayProgress += data.length) > progressThreshold) {
      // Delay sending progress.
      delayProgress = 0
      process.send({
        type: 'progress',
        data: currentByte
      })
    }
  })
  reader.on('error', error => {
    process.send({
      type: 'error',
      data: '' + error
    })
  })
  // reader.on('debug', data => {
  //   d(data)
  // })
  // reader.on('end', () => {
  //   d('end of file.')
  // })

  reader.start()
  startConstructionQueue()
}

process.on('message', (msg: WorkerMessage) => {
  if (!validateStartEnd(msg)) return
  switch (msg.type) {
    case 'start': start(msg); break
    case 'seekHeader': seekHeader(msg); break
    case 'prepare': prepare(msg); break
    case 'findNodesAnswer': gotNodesAnswer(msg); break
  }
})

let buildingQueue: NodeJS.Timer
/**
 * Keep fetching nodes from other workers.
 */
const startConstructionQueue = () => {

  buildingQueue = setTimeout(() => {
    if (incompleteWays.size > 0) {
      process.send(<WorkerMessage>{
        type: 'findNodes',
        data: Array.from(incompleteWays.keys())
      })
    } else {
      startConstructionQueue()
    }
  }, 1000)

}
const gotNodesAnswer = (msg: WorkerMessage) => {
  if (!Array.isArray(msg.data)) return
  // TODO: 1. Confirm, that Master answered with all the nodes.
  if (msg.data.some(el => el === undefined)) {
    return
  }

  // TODO: 2. Get all required nodes from other workers.

  // 3. Keep looking
  startConstructionQueue()
}
const planBuildingGeometry = (id: OSMObjectId, element: UEObject) => {
  if (hasAllNodes(element._incompleteBoundary)) {
    element = buildBoundaryGeometry(element)
    localWaysMemory.set(id, element)
  } else {
    incompleteWays.set(id, element)
  }
}

const buildBoundaryGeometry = (element: UEObject): UEObject => {
  const out: UEObject = {
    ...element
  }
  // TODO: finish it
  // const geometry: Geometry = out._incompleteBoundary

  // out.boundary = geometryToBoundary(geometry)
  return out
}

const validateStartEnd = (msg: WorkerMessage) => {
  if (typeof msg.start !== 'number' || typeof msg.end !== 'number') {
    process.send({
      type: 'error',
      data: new Error(`msg.start = ${msg.start}, msg.end = ${msg.end}. Both should be numbers.`)
    })
    return false
  }
  return true
}
const validateFileInput = (msg: WorkerMessage) => {
  if (typeof msg.inputPath !== 'string' || !fs.statSync(msg.inputPath).isFile) {
    process.send({
      type: 'error',
      data: new Error(`msg.inputPath = ${msg.inputPath}, can't find this file.`)
    })
    return false
  }
  return true
}
const isValidTagNameCharacter = (char: string) =>
  !(char === ' ' || char === '>' || char === '/')

// Do I have all the nodes required to finish this way?
const hasAllNodes = (nodes: Array<OSMObjectId>): boolean => {
  const required = nodes.length
  let have = 0
  for (const key in localNodesMemory.keys()) {
    if (nodes.some(reqNode => key === reqNode)) {
      have++
    }
  }
  return have === required
}

export type WorkerMessage = {
  type: string,
  inputPath?: string,
  start?: number,
  end?: number
  recordRegexp?: string,
  xmlHeader?: string,
  rootTagName?: string,
  data?: any
}
