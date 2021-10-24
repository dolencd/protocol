const { setTimeout } = require("timers/promises");
const client = require("./client");

const opts = {
    port_lower: parseInt(process.argv[2], 10),
    port_upper: parseInt(process.argv[3], 10),
    host_addr: process.argv[4],
    host_port: parseInt(process.argv[5], 10),
    idPrefix: process.argv[6],
    typeName: process.argv[7],
};

console.log(opts);

async function main() {
    for (let i = opts.port_lower; i < opts.port_upper; i++) {
        // eslint-disable-next-line no-await-in-loop
        await setTimeout(30);
        client({
            origin_port: i,
            host_addr: opts.host_addr,
            host_port: opts.host_port,
            deviceId: `${opts.idPrefix}-${i - opts.port_lower}`,
            deviceTypeName: opts.typeName,
        });
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
