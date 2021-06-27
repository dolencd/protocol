const { fork } = require("child_process");
const { join: pathJoin } = require("path")

const opts = {
    port_lower: parseInt(process.argv[2]),
    port_upper: parseInt(process.argv[3]),
    host_addr: process.argv[4],
    host_port: parseInt(process.argv[5])
}

console.log(opts);

async function main () {
    let i = opts.port_lower;
    const interval = setInterval(() => {
        if (i > opts.port_upper) clearInterval(interval)
        console.log("Starting", i);
        fork(pathJoin(__dirname, "client.js"), [
            i,
            opts.host_addr,
            opts.host_port
        ], {
            stdio: false
        })
        i++;
    }, 20)
}
main()
