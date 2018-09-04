# OSM to UE4 data parser

TODO: comunication between workers:

- worker1 needs some nodes, ask master where to find them
- master answers - worker2,3 and 4
- worker1 asks worker2, 3 and 4 for the nodes
- etc...

## dependencies

- node-ipc - communication between workers
- node-expat - parse incomming **stream** of XML data
- log-update - makes persistant progress bars possible in CLI
- chalk - colors for CLI logs

## requirements

- big XML file extract from Osmosis
- redis instance installed locally (used for caching `<node>` elements)
