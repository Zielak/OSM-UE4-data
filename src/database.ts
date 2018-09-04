import { OSMObjectId } from './types'

// import loki from 'lokijs'
// const db = new loki('db')
// const nodes = db.addCollection('nodes', {
//   unique: ['id']
// })

const nodes = new Map<OSMObjectId, number>()

export default {
  insert: (nodeId, workerId) => nodes.set(nodeId, workerId),
  get: nodeId => nodes.get(nodeId),
  gather: (nodeIdArr: Array<OSMObjectId>) => nodeIdArr.map(id => nodes.get(id)),
  count: () => nodes.size
}