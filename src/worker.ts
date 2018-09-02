import c from 'chalk'
import fs from 'fs'
import bigXml from './big-xml/big-xml'
import { JsonXmlObject, JsonXmlChild } from './types'
import { filterWayData, filterNodeData } from './filtersOsmosisJSON'

let recordRegex: RegExp
let inputPath: string

const d = (msg) => {
  process.send({ type: 'debug', data: msg })
}

const seekHeader = (msg: WorkerMessage) => {
  if (!validateFileInput(msg)) return
}

const prepare = (msg: WorkerMessage) => {
  if (!validateFileInput(msg)) return

  recordRegex = new RegExp('^' + msg.recordRegex + '$')
  inputPath = msg.inputPath

  let isCapturingTagName = false
  let tagName = ''
  let tagStartPos = NaN
  let charPos = 0
  let gotIt = false

  const finishPreparing = (fixedStartPoint: number) => {
    gotIt = true
    process.send({
      type: 'prepared',
      data: fixedStartPoint
    })
  }

  d(`creating stream: ${inputPath}:${msg.start}-${msg.end}`)
  const stream = fs.createReadStream(inputPath, {
    start: msg.start,
    end: msg.end
  })
  stream.on('close', () => {
    d(c.bgCyan('stram close'))
  })
  stream.on('end', () => {
    d(c.bgCyan('stram ended'))
  })
  stream.on('error', error => {
    d(c.bgRed.whiteBright.bold('stram ERROR: ' + error))
  })
  stream.on('readable', () => {
    d('stream readable...')
    let chunk: Buffer

    while (!gotIt && null !== (chunk = stream.read(1))) {

      // d(`[${chunk}]`)
      if (isCapturingTagName) {
        tagName += chunk.toString()
        if (isValidTagNameCharacter(chunk.toString())) {
          // d(`  valid tagname char "${chunk.toString()}"`)
          // d(`  tagName so far: "${tagName}"`)
          if (recordRegex.test(tagName)) {
            // d(`    got the name!: "${tagName}"`)
            // Got the name!
            finishPreparing(tagStartPos)
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
    }
  })
  stream.read(1)
}

const start = (msg: WorkerMessage) => {
  // We already have file path checked

  process.send({ type: 'debug', data: `start: ${msg.start}, end: ${msg.end}` })

  const reader = bigXml.createReader(inputPath, recordRegex, {
    start: msg.start,
    end: msg.end
  })

  reader.on('record', (record: JsonXmlObject) => {
    // process.send({ type: 'debug', data: 'got record' })
    if (record.tag === 'way') {
      const element = filterWayData(record)
      if (element) process.send({
        type: 'data',
        data: element
      })
    } else if (record.tag === 'node') {
      const element = filterNodeData(record)
      process.send({
        type: 'rememberNode',
        data: {
          id: record.attrs.id,
          node: element
        }
      })
    }
  })
  reader.on('error', error => {
    process.send({
      type: 'error',
      data: '' + error
    })
  })
  reader.on('debug', data => {
    process.send({
      type: 'debug', data
    })
  })
  reader.on('end', () => {
    process.exit()
  })
}

process.on('message', (msg: WorkerMessage) => {
  if (!validateStartEnd(msg)) return
  switch (msg.type) {
    case 'start': start(msg); break
    case 'seekHeader': seekHeader(msg); break
    case 'prepare': prepare(msg); break
  }
})

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

export type WorkerMessage = {
  type: string,
  inputPath?: string,
  start?: number,
  end?: number
  recordRegex?: string
  data?: any
}
