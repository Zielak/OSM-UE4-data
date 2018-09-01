import fs from 'fs'
import bigXml from './big-xml/big-xml'
import { JsonXmlObject, JsonXmlChild } from './types'
import { filterWayData, filterNodeData } from './filtersOsmosisJSON'

let reader

const init = (msg: WorkerMessage) => {
  if (typeof msg.start !== 'number' || typeof msg.end !== 'number') {
    process.send({
      type: 'error',
      data: new Error(`msg.start = ${msg.start}, msg.end = ${msg.end}. Both should be numbers.`)
    })
  }
  if (typeof msg.inputPath !== 'string' || !fs.statSync(msg.inputPath).isFile) {
    process.send({
      type: 'error',
      data: new Error(`msg.inputPath = ${msg.inputPath}, can't find this file.`)
    })
  }

  process.send({ type: 'debug', data: `start: ${msg.start}, end: ${msg.end}` })
  reader = bigXml.createReader(msg.inputPath, /^(node|way)$/, {
    start: msg.start,
    end: msg.end
  })
  reader.on('debug', data => {
    process.send({
      type: 'debug', data
    })
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
  reader.on('end', () => {
    process.exit()
  })

  setInterval(() => {
    process.send({ type: 'debug', data: 'ping' })
  }, 1000)
}

process.on('message', (msg: WorkerMessage) => {
  if (msg.type === 'init') {
    init(msg)
  }
})

export type WorkerMessage = {
  type: string,
  inputPath?: string,
  start?: number,
  end?: number
  data?: any
}
