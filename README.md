# Low bandwidth Application Protocol

The Low bandwidth application protocol is designed to allow two applications to communicate via application level calls over unreliable networks with as the smallest number and size of messages possible.

## Usage steps

    Client
    1. Call createClient
    2. Pass message to server
    6. Forward message from the server to the instance of Protocol obtained in step 1

    Server
    3. Receive message from client
    4. Call createServer
    5. Pass message to client

### Documentation

Reference documentation is available at https://dolencd.github.io/protocol/.

## Usage notes

- If the underlying protocol does not guarantee delivery, implement retransmission logic for the first message (step 2).


## Architecture

When using the library, a developer should only ever interact with the main Protocol class, but under the hood the functionality is split into 2 sub-classes, each with its own role.

### Top

The top later protocol handles application payloads directly. It provides functions and abstractions that, when used, store the data in a local state. When triggered, the top layer will encode this data into an array of bytes (an opaque message) that underlying communication layers need to deliver to the other instance of the library.

It requires that all messages are delivered correctly and in order.

### Bottom

The bottom layer is used when the underlying communications protocol does not meet the requirements of the top protocol. It provides guarantees in message delivery and ordering, handling processes like acknowledgements and message retransmission.

By default all protocol messages are bundled with application payloads, bringing maximum efficiency. There are options that speed up failure detection and message retransmission at the expense increased message size and number.

## TODO
 * Implement timers for acks
 * Provide options to send application data during the initial handshake
 * Handle sequence number looping
 * Dynamically set up objDelete proto
 * Provide functions to simplify initial message retransmission
 * Add optional CRC to bottom protocol
