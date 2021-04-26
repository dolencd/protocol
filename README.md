# Low bandwidth Application Protocol

The Low bandwidth application protocol is designed to allow two applications to communicate via application level calls over unreliable networks with as the smallest number and size of messages possible.

## Architecture

### Top Protocol

The top later protocol handles application payloads directly. It tracks data that is set to be transmitted and, when the time comes, sends it in an efficient format.

It requires that all messages are delivered correctly and in order.

### Bottom Protocol

The bottom protocol is used when the underlying communications protocol does not meet the requirements of the top protocol. It provides guarantees in message delivery and ordering.

By default all protocol messages are bundled with application payloads, bringing maximum efficiency. There are options that speed up failure detection and message retransmission at the expense increased message size and number.

## TODO
 * Add Object sync and delete handling
 * Handle sequence number looping
 * Dinamically set up object proto
 * Provide functions to simplify initial message retransmission
 * Add optional CRC to bottom protocol
