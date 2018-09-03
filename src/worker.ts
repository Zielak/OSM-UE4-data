import c from 'chalk'
import fs from 'fs'
import bigXml from './big-xml/big-xml'
import { JsonXmlObject, JsonXmlChild } from './types'
import { filterWayData, filterNodeData } from './filtersOsmosisJSON'

const d = (msg) => {
  process.send({ type: 'debug', data: msg })
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

  process.send({ type: 'debug', data: `start: ${msg.start}, end: ${msg.end}` })

  let currentByte = msg.start

  const reader = bigXml.createReader(msg.inputPath, msg.recordRegexp, {
    start: msg.start,
    end: msg.end,
    streamPrefix: msg.xmlHeader || '',
    streamSuffix: msg.rootTagName ? `<${msg.rootTagName}/>` : ''
  })

  reader.on('record', (record: JsonXmlObject) => {
    // process.send({
    //   type: 'debug',
    //   data: `got record: ${JSON.stringify(record)}`
    // })
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
  reader.on('data', data => {
    currentByte += data.length
    process.send({
      type: 'progress',
      data: currentByte
    })
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
    d('end...?')
    // process.exit()
  })

  reader.start()
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
  recordRegexp?: string,
  xmlHeader?: string,
  rootTagName?: string,
  data?: any
}
