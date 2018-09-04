
export type WorkerState = {
  prepared: boolean,
  finished: boolean,
  initialByteStart?: number,
  initialByteEnd?: number,
  preparedByteStartOffset?: number,
  preparedByteStart?: number,
  preparedByteEnd?: number,
  currentByte?: number
  xmlHeader?: string,
  rootTagName?: string
}

export type GeometryItem = {
  lat: number,
  lon: number
}
export type Geometry = Array<GeometryItem>

export type Boundary = {
  x: number,
  y: number,
  // z: number, // TODO: heightmaps?
  length: number,
  height?: number,
  thickness?: number,
  angleZ: number,
}

export type OSMObjectId = string

export enum OSMObjectType {
  node = 'node',
  way = 'way',
  rel = 'rel'
}

export type OSMObject = {
  id?: OSMObjectId,
  osm_id?: number,
  type: OSMObjectType,
  geometry: Geometry,
  center?: {
    lat: number,
    lon: number
  }
  tags?: {
    [key: string]: string
  }
}

export type JsonXmlObject = {
  tag: OSMObjectType,
  attrs: {
    minlon?: string,
    minlat?: string,
    maxlon?: string,
    maxlat?: string,
    origin?: string,

    version?: string,
    timestamp?: string,
    uid?: string,
    user?: string,
    lat?: string,
    lon?: string,

    id?: OSMObjectId,
  },
  text?: string,
  children: Array<JsonXmlChild>
}

export type JsonXmlChild = {
  tag?: string,
  attrs: {
    k?: string,
    v?: string,
    ref?: string
  }
}

export type UEObject = {
  Name?: OSMObjectId,
  type: OSMObjectType,
  lat?: number,
  lon?: number,
  center_x?: number,
  center_y?: number,
  boundary?: Array<Boundary>
  _incompleteBoundary?: Array<string>
  tags?: {
    [key: string]: string
  }
}