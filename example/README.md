### Overview
The example is a simple client-server model where the client sends events, calls methods and updates values at an interval that is set by the server using object syncing.

UDP us used for communication and the bottom protocol us used to ensure reliability.

An additional clientRunner script is provided, which is designed to start many client instances.

### Running the example

1. Build the project

    `yarn install`

    `yarn build`

2. Run the server
    The server script accepts the port it will listen on as a parameter.

    Example usage: `node example/server.js 5000`

3. Run the client

    The client script accepts the following arguments:

        1. Local port to use (for sending packets)
        2. Address of the server
        3. Port that the server uses

    Example usage: `node example/client.js 3000 localhost 5000`

3.5 (Optional) Run multiple clients using the provided script

    The script accepts the lower bound port (inclusive) and an upper bound port (exclusive)

    Example usage: `node example/clientRunner.js 3000 3010 localhost 5000` 