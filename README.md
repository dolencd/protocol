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

### Top Protocol

The top later protocol handles application payloads directly. It tracks data that is set to be transmitted and, when the time comes, sends it in an efficient format.

It requires that all messages are delivered correctly and in order.

### Bottom Protocol

The bottom protocol is used when the underlying communications protocol does not meet the requirements of the top protocol. It provides guarantees in message delivery and ordering.

By default all protocol messages are bundled with application payloads, bringing maximum efficiency. There are options that speed up failure detection and message retransmission at the expense increased message size and number.

## TODO
 * Implement timers for acks
 * Provide options to send application data during the initial handshake
 * Add Object sync and delete handling
 * Handle sequence number looping
 * Dinamically set up object proto
 * Provide functions to simplify initial message retransmission
 * Add optional CRC to bottom protocol
