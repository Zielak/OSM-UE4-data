import bigXml from './big-xml/big-xml'
import { JsonXmlObject, JsonXmlChild } from './types'
import { filterWayData } from './filtersOsmosisJSON'

export default (filePath, { start = 0, end = Infinity }: LocalDataOptions) => new Promise((resolve, reject) => {
  const list = []

  const reader = bigXml.createReader(filePath, /^(node|way)$/, {
    start, end
  })
  reader.on('record', (record: JsonXmlObject) => {
    const element = filterWayData(record)
    if (element) list.push(element)
  })
  reader.on('error', reject)
  reader.on('end', () => resolve(list))
})

type LocalDataOptions = {
  start: number,
  end: number
}
